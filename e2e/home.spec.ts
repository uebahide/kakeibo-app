import { addExpense, expect, openApp, openEntry, test } from "./fixtures";

test("an empty app explains how to start and splits the week over the days left", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("まだ記録がありません")).toBeVisible();
  // the week's ¥37,100 over the 4 days left in it, the same as the week card's per-day share
  await expect(page.getByText("¥9,275", { exact: true })).toBeVisible();
  await expect(page.getByText("ゆとりあり").first()).toBeVisible();
});

test("the week card splits the budget over this week", async ({ page }) => {
  await openApp(page);
  // Oct 12–18; ¥106,000 over the 20 days left on the 12th, times 7
  await expect(page.getByText("10/12〜10/18")).toBeVisible();
  await expect(page.getByText("¥37,100", { exact: true })).toBeVisible();
  await expect(page.getByText("残り4日、1日あたり ¥9,275")).toBeVisible();

  await addExpense(page, "1200");
  await expect(page.getByText("¥35,900", { exact: true })).toBeVisible();
  await expect(page.getByText("使った ¥1,200 / 今週の枠 ¥37,100")).toBeVisible();
  // Today's bar has today's limit as its share, the same as the top card
  await expect(page.getByText("/ 今日の枠 ¥9,275")).toBeVisible();
  await expect(page.getByRole("button", { name: "木 使った ¥1,200 / 枠 ¥9,275" })).toBeVisible();
});

test("recording an expense lowers today's amount and shows in recent records", async ({ page }) => {
  await openApp(page);
  await addExpense(page, "1200", "食費", "ランチ");

  await expect(page.getByRole("status")).toHaveText("食費 ¥1,200 を記録しました");
  await expect(page.getByText("¥8,075", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "今日の出費 ¥1,200 ›" })).toBeVisible();
  await expect(page.getByText("¥104,800", { exact: true })).toBeVisible();
  await expect(page.getByText("ランチ").first()).toBeVisible();

  // Demo mode keeps records in the browser
  await page.reload();
  await expect(page.getByText("¥8,075", { exact: true })).toBeVisible();
});

test("an expense outside the budget leaves today's amount alone", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("30000");
  await sheet.getByRole("button", { name: "娯楽", exact: true }).click();
  await sheet.getByRole("radio", { name: /予算外/ }).click();
  await sheet.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("¥9,275", { exact: true })).toBeVisible();
  await expect(page.getByText("¥106,000", { exact: true })).toBeVisible();
});

test("saving without an amount asks for one", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  await page.getByRole("dialog").getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("金額を入れてください");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a long description in a day's popup is cut short so the amount stays inside", async ({ page, isMobile }) => {
  await openApp(page);
  await addExpense(page, "404", "食費", "SPAR Partner (Szliven-Market Kft.) Budapest Bartók Béla út");

  const thursday = page.getByRole("button", { name: /^木 使った/ });
  if (isMobile) await thursday.tap();
  else await thursday.hover();
  const popup = page.getByRole("dialog", { name: "10/15（木）" });
  const amount = popup.getByRole("listitem").getByText("¥404", { exact: true });
  await expect(amount).toBeVisible();
  const box = (await popup.boundingBox())!;
  const amountBox = (await amount.boundingBox())!;
  expect(amountBox.x + amountBox.width).toBeLessThanOrEqual(box.x + box.width);
});

test("the N key opens the entry sheet on a computer", async ({ page, isMobile }) => {
  test.skip(isMobile, "phones have no keyboard shortcut");
  await openApp(page);
  await page.keyboard.press("n");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a day's bar opens what was spent that day", async ({ page, isMobile }) => {
  await openApp(page);
  await addExpense(page, "1200", "食費", "ランチ");
  await addExpense(page, "800", "交通", "バス");

  const thursday = page.getByRole("button", { name: /^木 使った/ });
  if (isMobile) await thursday.tap();
  else await thursday.hover();
  const popup = page.getByRole("dialog", { name: "10/15（木）" });
  await expect(popup).toBeVisible();
  await expect(popup.getByText("合計 ¥2,000")).toBeVisible();
  await expect(popup.getByText("枠 ¥9,275")).toBeVisible();
  await expect(popup.getByText("枠まで あと ¥7,275")).toBeVisible();
  await expect(popup.getByText("ランチ")).toBeVisible();
  await expect(popup.getByText("バス")).toBeVisible();

  // Another day shows its own details; a day ahead says so
  const saturday = page.getByRole("button", { name: /^土 使った/ });
  if (isMobile) await saturday.tap();
  else await saturday.hover();
  await expect(page.getByRole("dialog", { name: "10/17（土）" }).getByText("まだ先の日です")).toBeVisible();
  await expect(popup).toBeHidden();

  // Escape closes it
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
