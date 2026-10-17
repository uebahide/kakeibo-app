import { expect, nav, openApp, openEntry, test } from "./fixtures";

test("a deleted record can be put back with Undo, and stays back after a reload", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("5000");
  await sheet.getByRole("button", { name: "食費", exact: true }).click();
  await sheet.getByPlaceholder("例：スーパー").fill("スーパー");
  await sheet.getByRole("button", { name: "＋ 複数のカテゴリに分ける" }).click();
  await sheet.getByLabel("内訳2のカテゴリ").selectOption({ label: "日用品" });
  await sheet.getByLabel("内訳2の金額").fill("1200");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: /スーパー/ }).click();
  await sheet.getByRole("button", { name: "削除" }).click();
  await sheet.getByRole("button", { name: "本当に削除" }).click();
  await expect(page.getByRole("status")).toHaveText("削除しました");
  await expect(page.getByRole("button", { name: /スーパー/ })).toBeHidden();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("status")).toHaveText("元に戻しました");
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeHidden();
  // Every part of the payment comes back as it was
  const row = page.getByRole("button", { name: /スーパー/ });
  await expect(row).toContainText("食費¥3,800");
  await expect(row).toContainText("日用品¥1,200");

  await page.reload();
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await expect(page.getByRole("button", { name: /スーパー/ })).toContainText("¥5,000");
});

test("Undo goes away with the next message, and the delete stays", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("800");
  await sheet.getByPlaceholder("例：スーパー").fill("パン屋");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: /パン屋/ }).click();
  await sheet.getByRole("button", { name: "削除" }).click();
  await sheet.getByRole("button", { name: "本当に削除" }).click();
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeVisible();

  await openEntry(page);
  await sheet.getByLabel("金額").fill("300");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(/を記録しました/);
  await expect(page.getByRole("button", { name: "元に戻す" })).toBeHidden();
  await expect(page.getByRole("button", { name: /パン屋/ })).toBeHidden();
});

test("a deleted record can be put back later from Recently deleted, in the history or the settings", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("800");
  await sheet.getByPlaceholder("例：スーパー").fill("パン屋");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  // Shown before anything is deleted, with nothing in it
  await page.getByRole("button", { name: "最近削除した記録" }).click();
  const trash = page.getByRole("dialog", { name: "最近削除した記録" });
  await expect(trash).toContainText("最近削除した記録はありません");
  await expect(trash).not.toContainText("30日間");
  await trash.getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: /パン屋/ }).click();
  await sheet.getByRole("button", { name: "削除" }).click();
  await sheet.getByRole("button", { name: "本当に削除" }).click();
  await expect(page.getByRole("button", { name: /パン屋/ })).toBeHidden();

  // Still there after a reload, long after "Undo" has gone
  await page.reload();
  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  await expect(page.getByRole("button", { name: "最近削除した記録（1件）" })).toBeVisible();
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: "最近削除した記録（1件）" }).click();
  await expect(trash).toContainText("パン屋");
  await expect(trash).toContainText("あと30日");
  await trash.getByRole("button", { name: "パン屋を戻す" }).click();
  await expect(page.getByRole("status")).toHaveText("元に戻しました");
  await expect(trash).toContainText("最近削除した記録はありません");
  await trash.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByRole("button", { name: /パン屋/ })).toContainText("¥800");
  await expect(page.getByRole("button", { name: "最近削除した記録" })).toBeVisible();
});

test("everything in Recently deleted can be deleted for good at once", async ({ page }) => {
  await openApp(page);
  const sheet = page.getByRole("dialog");
  for (const memo of ["パン屋", "カフェ"]) {
    await openEntry(page);
    await sheet.getByLabel("金額").fill("500");
    await sheet.getByPlaceholder("例：スーパー").fill(memo);
    await sheet.getByRole("button", { name: "保存", exact: true }).click();
    await expect(sheet).toBeHidden();
  }
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  for (const memo of ["パン屋", "カフェ"]) {
    await page.getByRole("button", { name: new RegExp(memo) }).click();
    await sheet.getByRole("button", { name: "削除" }).click();
    await sheet.getByRole("button", { name: "本当に削除" }).click();
    await expect(sheet).toBeHidden();
  }

  await page.getByRole("button", { name: "最近削除した記録（2件）" }).click();
  const trash = page.getByRole("dialog", { name: "最近削除した記録" });
  await trash.getByRole("button", { name: "すべて完全に削除" }).click();
  await trash.getByRole("button", { name: "本当にすべて完全に削除" }).click();
  await expect(page.getByRole("status")).toHaveText("完全に削除しました");
  await expect(trash).toContainText("最近削除した記録はありません");
  await expect(trash.getByRole("button", { name: /完全に削除/ })).toBeHidden();

  await page.reload();
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await page.getByRole("button", { name: "最近削除した記録" }).click();
  await expect(page.getByRole("dialog", { name: "最近削除した記録" })).toContainText("最近削除した記録はありません");
});

test("swiping a history row to the left shows a delete button", async ({ page }) => {
  await openApp(page);
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("金額").fill("800");
  await sheet.getByPlaceholder("例：スーパー").fill("パン屋");
  await sheet.getByRole("button", { name: "保存", exact: true }).click();
  await expect(sheet).toBeHidden();
  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();

  const row = page.getByRole("button", { name: /パン屋/ });
  const box = (await row.boundingBox())!;
  const y = box.y + box.height / 2;
  // A short swipe springs back; the record does not open either
  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, y, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();
  await expect(row).toHaveCSS("transform", "none");

  await page.mouse.move(box.x + box.width - 20, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 140, y, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toBeHidden();
  await page.getByRole("button", { name: "パン屋を削除" }).click();
  await expect(page.getByRole("status")).toHaveText("削除しました");
  await expect(row).toBeHidden();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("button", { name: /パン屋/ })).toContainText("¥800");
});
