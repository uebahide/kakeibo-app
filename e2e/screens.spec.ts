import { addExpense, expect, nav, openApp, test } from "./fixtures";

test("history lists records and lets one be edited and deleted", async ({ page }) => {
  await openApp(page);
  await addExpense(page, "800", "交通", "バス");
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();

  await page.getByText("バス").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("記録を編集")).toBeVisible();
  await sheet.getByLabel("金額").fill("900");
  await sheet.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByRole("status")).toHaveText("更新しました");
  await expect(page.getByText("¥900").first()).toBeVisible();

  await page.getByText("バス").click();
  await sheet.getByRole("button", { name: "削除" }).click();
  await sheet.getByRole("button", { name: "本当に削除" }).click();
  await expect(page.getByRole("status")).toHaveText("削除しました");
  await expect(page.getByText("バス")).toBeHidden();
});

test("the analysis screen draws its charts from sample data", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "サンプルを入れる" }).click();
  await expect(page.getByText("まだ記録がありません")).toBeHidden();
  await nav(page).getByRole("button", { name: "分析", exact: true }).click();

  await expect(page.getByText("2026年10月のカテゴリ別支出（固定費込み）")).toBeVisible();
  await expect(page.getByText("変動費の予算に対するペース")).toBeVisible();
  await expect(page.getByText("週ごとの変動費（8週間）")).toBeVisible();
  await expect(page.getByText("収入と支出の推移（6か月）")).toBeVisible();
  await expect(page.getByText("曜日ごとの使い方")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
});

test("the month arrows move between months", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("2026年10月").first()).toBeVisible();
  await page.getByRole("button", { name: "前の月" }).click();
  await expect(page.getByText("2026年9月").first()).toBeVisible();
  // A past month has no "today" figure
  await expect(page.getByText("今日使える額")).toBeHidden();
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.getByText("今日使える額")).toBeVisible();
});

test("switching the language to English changes the whole screen", async ({ page }) => {
  await openApp(page);
  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("radiogroup", { name: "言語" }).getByRole("radio", { name: "English" }).click();

  await expect(page.getByRole("status")).toHaveText("Switched to English");
  await expect(nav(page).getByRole("button", { name: "Home", exact: true })).toBeVisible();
  await nav(page).getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByText("Left to spend today")).toBeVisible();
});

test("the screen fits the width without sideways scrolling", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "サンプルを入れる" }).click();
  await expect(page.getByText("まだ記録がありません")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});

test("weeks can start on Sunday", async ({ page }) => {
  await openApp(page);
  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await page.getByRole("radiogroup", { name: "週の始まり" }).getByRole("radio", { name: "日曜日" }).click();
  await expect(page.getByRole("status")).toHaveText("週を日曜日から数えます");

  await nav(page).getByRole("button", { name: "ホーム", exact: true }).click();
  // Oct 11–17; ¥106,000 over the 21 days left on the 11th, times 7
  await expect(page.getByText("10/11〜10/17")).toBeVisible();
  await expect(page.getByText("¥35,333", { exact: true })).toBeVisible();
});
