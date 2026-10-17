import { expect, nav, openApp, test } from "./fixtures";

/** Monday, October 12, 2026: the first day after the week of Oct 5–11. */
const MONDAY = new Date("2026-10-12T12:00:00+09:00");

test("last week's review shows on the home screen in the new week's first days, until it is closed", async ({ page }) => {
  await page.clock.setFixedTime(MONDAY);
  await openApp(page);
  await expect(page.getByText("先週のふりかえり")).toBeHidden();
  // Demo mode shows a sample review made from the sample records.
  await page.getByRole("button", { name: "サンプルを入れる" }).click();
  const card = page.locator("section").filter({ hasText: "先週のふりかえり" });
  await expect(card).toBeVisible();
  await expect(card.getByText("10/5〜10/11")).toBeVisible();
  await expect(card.getByText(/^今週使える額 ¥[\d,]+（1日 ¥[\d,]+）$/)).toBeVisible();

  await card.getByRole("button", { name: "AI分析で見る" }).click();
  await expect(page.getByText("10/5〜10/11 のふりかえり")).toBeVisible();
  await expect(page.getByText("よかった点")).toBeVisible();

  await nav(page).getByRole("button", { name: "ホーム" }).click();
  await card.getByRole("button", { name: "閉じる" }).click();
  await expect(card).toBeHidden();
  await page.reload();
  // The sample records are random, so today may be over its share: wait for the week card instead.
  await expect(page.getByText("10/12〜10/18")).toBeVisible();
  await expect(page.getByText("先週のふりかえり")).toBeHidden();
});

test("the home screen leaves the review out later in the week", async ({ page }) => {
  await openApp(page); // Thursday
  await page.getByRole("button", { name: "サンプルを入れる" }).click();
  await expect(page.getByText("サンプルを", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("先週のふりかえり")).toBeHidden();
});
