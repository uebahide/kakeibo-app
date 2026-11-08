import { addExpense, expect, openApp, test } from "./fixtures";

test("a record shows the time it was entered, in the list and its details", async ({ page }) => {
  await openApp(page);
  await addExpense(page, "1200", "食費", "ランチ");

  // "Today" in screen tests is noon in Japan
  const row = page.getByRole("button", { name: /ランチ/ }).first();
  await expect(row).toContainText("12:00");

  await row.click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByText("記録した時刻")).toBeVisible();
  await expect(detail.getByText("12:00", { exact: true })).toBeVisible();
});
