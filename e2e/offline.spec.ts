import { addExpense, expect, openApp, test } from "./fixtures";

// The service worker is blocked in the other tests (playwright.config.ts) so pages aren't kept between them.
test.use({ serviceWorkers: "allow" });

test("the app opens without a signal once it has been opened before", async ({ page, context }) => {
  await openApp(page);
  await addExpense(page, "1200", "食費", "ランチ");
  // the worker takes over once ready; reload so this page's files go through it and are kept
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText("今日使える額")).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("今日使える額")).toBeVisible();
  await expect(page.getByText("ランチ")).toBeVisible();
  await context.setOffline(false);
});
