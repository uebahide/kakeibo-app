import type { Page } from "@playwright/test";
import { addExpense, expect, nav, openApp, openEntry, test } from "./fixtures";

async function openCategories(page: Page) {
  await nav(page).getByRole("button", { name: "設定", exact: true }).click();
  // The list starts closed
  await page.getByRole("button", { name: "並び替え・編集" }).click();
  return page.getByRole("list", { name: "カテゴリ" });
}

/** The category buttons on the entry sheet, in order. */
async function entryCategories(page: Page) {
  await openEntry(page);
  const sheet = page.getByRole("dialog");
  const names = await sheet.getByRole("group", { name: "カテゴリ" }).getByRole("button").allInnerTexts();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  return names.map((n) => n.trim().split("\n").at(-1)!.trim());
}

test("an added category can be picked, gets a budget and stays after reload", async ({ page }) => {
  await openApp(page);
  const list = await openCategories(page);
  await page.getByLabel("カテゴリを追加").fill("カフェ");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("「カフェ」を追加しました");
  await expect(list.getByRole("listitem", { name: "カフェ" })).toBeVisible();
  // Its budget can be set like any variable cost
  await expect(page.locator("label").filter({ hasText: "カフェ" }).getByRole("textbox")).toBeVisible();

  // The same name again is refused
  await page.getByLabel("カテゴリを追加").fill("カフェ");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("「カフェ」はもうあります");

  await addExpense(page, "550", "カフェ", "ラテ");
  await expect(page.getByRole("status")).toHaveText("カフェ ¥550 を記録しました");

  await page.reload();
  await expect(page.getByText("今日使える額")).toBeVisible();
  expect(await entryCategories(page)).toContain("カフェ");
});

test("an app category can be renamed, hidden and reset", async ({ page }) => {
  await openApp(page);
  const list = await openCategories(page);

  await list.getByRole("button", { name: "食費を編集" }).click();
  await list.getByRole("textbox", { name: "名前" }).fill("外食");
  await list.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("「外食」を保存しました");

  await list.getByRole("button", { name: "衣服を編集" }).click();
  await list.getByLabel("非表示にする").check();
  await list.getByRole("button", { name: "保存", exact: true }).click();
  await expect(list.getByRole("listitem", { name: "衣服" }).getByText("非表示")).toBeVisible();

  const names = await entryCategories(page);
  expect(names).toContain("外食");
  expect(names).not.toContain("食費");
  expect(names).not.toContain("衣服");

  await list.getByRole("button", { name: "外食を編集" }).click();
  await list.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByRole("status")).toHaveText("「食費」を元に戻しました");
  expect(await entryCategories(page)).toContain("食費");
});

test("the order set in Settings is the order on the entry sheet", async ({ page }) => {
  await openApp(page);
  const list = await openCategories(page);
  for (let i = 0; i < 3; i++) await list.getByRole("button", { name: "交通を上へ" }).click();
  await expect(list.getByRole("listitem").first()).toHaveAccessibleName("交通");
  expect((await entryCategories(page)).slice(0, 3)).toEqual(["交通", "食費", "菓子・酒"]);
});

test("deleting an added category moves its records to the chosen one", async ({ page }) => {
  await openApp(page);
  const list = await openCategories(page);
  await page.getByLabel("カテゴリを追加").fill("カフェ");
  await page.getByRole("button", { name: "追加", exact: true }).click();
  await addExpense(page, "550", "カフェ", "ラテ");

  await list.getByRole("button", { name: "カフェを編集" }).click();
  await list.getByRole("button", { name: "カフェを削除" }).click();
  await list.getByLabel("1件の記録の移動先").selectOption({ label: "交際" });
  await list.getByRole("button", { name: "削除する" }).click();
  await expect(page.getByRole("status")).toHaveText("「カフェ」を削除しました");
  await expect(list.getByRole("listitem", { name: "カフェ" })).toBeHidden();

  await nav(page).getByRole("button", { name: "履歴", exact: true }).click();
  await expect(page.getByText("ラテ")).toBeVisible();
  await expect(page.getByText("交際").first()).toBeVisible();
});
