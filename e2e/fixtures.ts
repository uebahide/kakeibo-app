import { test as base, expect, type Page } from "@playwright/test";

/** "Today" in every screen test: Thursday, October 15, 2026, noon in Japan. Day 15 of 31, so 17 days are left. */
export const TODAY = new Date("2026-10-15T12:00:00+09:00");

export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.clock.setFixedTime(TODAY);
    await provide(page);
  },
});

export { expect };

/** Opens the app and waits for the records to load. */
export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByText("今日使える額")).toBeVisible();
}

/** The navigation this screen size shows: the bottom tab bar on a phone, the side menu on a computer (the other is hidden). */
export const nav = (page: Page) => page.getByRole("navigation");

/** Opens the entry sheet with the button this screen size shows. */
export async function openEntry(page: Page) {
  await nav(page).getByRole("button", { name: "記入する" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Records an expense through the entry sheet. */
export async function addExpense(page: Page, amount: string, category = "食費", memo = "") {
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill(amount);
  await sheet.getByRole("button", { name: category, exact: true }).click();
  if (memo) await sheet.getByPlaceholder("例：スーパー").fill(memo);
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(sheet).toBeHidden();
}
