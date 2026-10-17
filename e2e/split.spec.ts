import { expect, nav, openApp, openEntry, test } from "./fixtures";

test("one payment can be split over categories, shown and edited as one", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("5000");
  await sheet.getByRole("button", { name: "食費", exact: true }).click();
  await sheet.getByPlaceholder("例：スーパー").fill("スーパー");
  await sheet.getByRole("button", { name: "＋ 複数のカテゴリに分ける" }).click();
  const split = sheet.getByRole("region", { name: "内訳" });
  await split.getByLabel("内訳2のカテゴリ").selectOption({ label: "日用品" });
  await split.getByLabel("内訳2の金額").fill("1200");
  await split.getByLabel("内訳2の説明").fill("シャンプー");
  await expect(split.getByText("¥3,800")).toBeVisible();
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("¥5,000 を2つのカテゴリに分けて記録しました");

  // Each part counts in its own category: ¥106,000 budget − ¥5,000
  await expect(page.getByText("¥101,000").first()).toBeVisible();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  const row = page.getByRole("button", { name: /スーパー/ });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("食費¥3,800");
  await expect(row).toContainText("日用品（シャンプー）¥1,200");
  await expect(row).toContainText("¥5,000");

  // Filtering by a category shows just its part
  await page.getByRole("group", { name: "絞り込み" }).getByRole("button", { name: "日用品" }).click();
  await expect(page.getByRole("button", { name: /スーパー/ })).toContainText("¥1,200");
  await page.getByRole("group", { name: "絞り込み" }).getByRole("button", { name: "すべて" }).click();

  // Editing opens the whole payment; removing the part puts it all back in food
  await row.click();
  await expect(sheet.getByLabel("金額", { exact: true })).toHaveValue("5,000");
  await sheet.getByRole("button", { name: "内訳2を外す" }).click();
  await sheet.getByRole("button", { name: "更新する" }).click();
  await expect(page.getByRole("status")).toHaveText("更新しました");
  await expect(page.getByRole("button", { name: /スーパー/ })).toContainText("食費");
  await expect(page.getByRole("button", { name: /スーパー/ })).not.toContainText("日用品");

  // Deleting a split payment deletes every part
  await page.getByRole("button", { name: /スーパー/ }).click();
  await sheet.getByRole("button", { name: "＋ 複数のカテゴリに分ける" }).click();
  await sheet.getByLabel("内訳2の金額").fill("1000");
  await sheet.getByRole("button", { name: "更新する" }).click();
  await page.getByRole("button", { name: /スーパー/ }).click();
  await sheet.getByRole("button", { name: "削除" }).click();
  await sheet.getByRole("button", { name: "本当に削除" }).click();
  await expect(page.getByText("スーパー")).toBeHidden();
});

test("a split asks for every part's amount and keeps the parts under the total", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("1000");
  await sheet.getByRole("button", { name: "＋ 複数のカテゴリに分ける" }).click();
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("内訳の金額を入れてください");
  await sheet.getByLabel("内訳2の金額").fill("1000");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("内訳の合計が金額を超えています");
  await expect(sheet).toBeVisible();
});

test("a payment kept in one category can have a note too, which stays when it is split", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("680");
  await sheet.getByRole("button", { name: "日用品", exact: true }).click();
  await sheet.getByPlaceholder("例：スーパー").fill("ドラッグストア");
  await sheet.getByLabel("説明", { exact: true }).fill("シャンプー");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  const row = page.getByRole("button", { name: /ドラッグストア/ });
  await expect(row).toContainText("日用品（シャンプー）");

  // The note is kept on editing; splitting moves it to the first part
  await row.click();
  await expect(sheet.getByLabel("説明", { exact: true })).toHaveValue("シャンプー");
  await sheet.getByRole("button", { name: "＋ 複数のカテゴリに分ける" }).click();
  await expect(sheet.getByLabel("説明", { exact: true })).toBeHidden();
  await expect(sheet.getByLabel("内訳1の説明")).toHaveValue("シャンプー");
});
