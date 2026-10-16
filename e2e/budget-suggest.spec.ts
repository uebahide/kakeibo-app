import { expect, nav, openApp, test } from "./fixtures";

// Two months of records before October: food over its ¥40,000 budget both months, fun well under its ¥15,000.
const records = [
  ["2026-08-10", 45000, "food"],
  ["2026-09-10", 47000, "food"],
  ["2026-08-12", 6000, "fun"],
  ["2026-09-12", 5000, "fun"],
].map(([date, amount, category], i) => ({
  id: `seed${i}`,
  date,
  amount,
  type: "expense",
  category,
  memo: "",
  isSample: false,
  createdAt: `${date}T00:00:00Z`,
}));

test.beforeEach(async ({ page }) => {
  // October 3: early in the new month, when Home offers the suggestion
  await page.clock.setFixedTime(new Date("2026-10-03T12:00:00+09:00"));
  await page.addInitScript((txs) => {
    if (!localStorage.getItem("kakeibo-app.v1")) localStorage.setItem("kakeibo-app.v1", JSON.stringify({ transactions: txs }));
  }, records);
});

test("Home suggests this month's budget and uses it as is", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("2026年10月の予算の提案")).toBeVisible();
  await page.getByRole("button", { name: "提案を見る" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("8月・9月の実績から")).toBeVisible();
  await expect(sheet.getByText("2か月とも予算を超えていました（平均 ¥46,000）")).toBeVisible();
  await expect(sheet.getByText("平均 ¥5,500 で、毎月 ¥9,500 ほど余っていました")).toBeVisible();
  await expect(sheet.getByText("収入の記録がないので、収入に収まるかは見ていません。")).toBeVisible();

  await sheet.getByRole("button", { name: "そのまま使う" }).click();
  await expect(page.getByRole("status")).toHaveText("予算を変えました");
  await expect(page.getByText("2026年10月の予算の提案")).toBeHidden();

  // Answered for October: the card stays away after a reload
  await page.reload();
  await expect(page.getByText("今日使える額")).toBeVisible();
  await expect(page.getByText("2026年10月の予算の提案")).toBeHidden();
  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.locator("#budget-food")).toHaveValue("46000");
  await expect(page.locator("#budget-fun")).toHaveValue("5500");
});

test("only the categories left checked change", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "提案を見る" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "一部だけ変える" }).click();
  await sheet.getByRole("checkbox", { name: /娯楽/ }).uncheck();
  await sheet.getByRole("button", { name: /件を反映/ }).click();
  await expect(page.getByRole("status")).toHaveText("予算を変えました");

  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.locator("#budget-food")).toHaveValue("46000");
  await expect(page.locator("#budget-fun")).toHaveValue("15000");
});

test("turning the suggestion down leaves the budget alone, and Settings can still show it", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "今回は使わない" }).click();
  await expect(page.getByText("2026年10月の予算の提案")).toBeHidden();

  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.locator("#budget-food")).toHaveValue("40000");
  await page.getByRole("button", { name: "これまでの実績から提案" }).click();
  await expect(page.getByRole("dialog").getByText("2か月とも予算を超えていました（平均 ¥46,000）")).toBeVisible();
});
