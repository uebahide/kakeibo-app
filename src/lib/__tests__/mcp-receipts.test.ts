import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/categories";
import type { NewTransaction, Transaction } from "@/lib/types";
import { tx } from "./helpers";

// The tools run against an in-memory store standing in for the signed-in user's Supabase data.
const W1 = "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f";
let records: Transaction[] = [];
const receiptUpdates: unknown[] = [];
let seq = 0;
const store = {
  load: async () => ({ transactions: records, settings: structuredClone(DEFAULT_SETTINGS) }),
  updateTransaction: async (id: string, item: NewTransaction) => {
    const i = records.findIndex((r) => r.id === id);
    records[i] = { ...item, id, createdAt: records[i].createdAt };
    return records[i];
  },
  addTransactions: async (items: NewTransaction[]) => {
    const created = items.map((item) => ({ ...item, id: `n${++seq}`, createdAt: `2026-10-16T00:00:0${seq}Z` }));
    records.push(...created);
    return created;
  },
  deleteTransaction: async (id: string) => {
    records = records.filter((r) => r.id !== id);
  },
};
vi.mock("server-only", () => ({}));
vi.mock("@/lib/store/supabase", () => ({ createSupabaseStore: () => store }));
vi.mock("@/lib/mcp/auth", async (actual) => ({
  ...(await actual<typeof import("@/lib/mcp/auth")>()),
  supabaseFor: () => ({
    from: () => ({ update: (row: unknown) => ({ eq: async () => (receiptUpdates.push(row), { error: null }) }) }),
  }),
}));

type Handler = (input: Record<string, unknown>, ctx: unknown) => Promise<{ isError?: boolean; content: { type: string; text?: string }[] }>;
const tools = new Map<string, { schema: { parse: (v: unknown) => Record<string, unknown> }; run: Handler }>();
const { registerReceiptTools } = await import("@/lib/mcp/receipts");
registerReceiptTools({
  registerTool: (name: string, config: { inputSchema: { parse: (v: unknown) => Record<string, unknown> } }, run: Handler) => tools.set(name, { schema: config.inputSchema, run }),
} as never);
/** Calls a tool as the connector signed in to `email` (none: the token carries no email). */
const call = (name: string, input: Record<string, unknown>, email?: string) => {
  const tool = tools.get(name)!;
  return tool.run(tool.schema.parse(input), email ? { http: { authInfo: { extra: { email } } } } : {});
};
const text = (r: Awaited<ReturnType<typeof call>>) => r.content.map((c) => c.text ?? "").join("");

const items = [
  { name: "牛乳", amount: 230, category: "food" },
  { name: "食パン", amount: 180, category: "food" },
  { name: "値引", amount: -30, category: "food" },
  { name: "シャンプー", amount: 640, category: "daily" },
];

beforeEach(() => {
  records = [tx("2026-10-15", 1020, { id: W1, memo: "ライフ", receiptId: "r1", needsReview: true, createdAt: "2026-10-15T09:00:00Z" })];
  receiptUpdates.length = 0;
});

describe("receipt tools for claude.ai", () => {
  it("list the records with a photo waiting to be sorted, with the categories to use", async () => {
    records.push(tx("2026-10-14", 500, { id: "x" }));
    const list = JSON.parse(text(await call("list_receipts_to_sort", {})));
    expect(list.records.map((r: { record_id: string; total: number }) => [r.record_id, r.total])).toEqual([[W1, 1020]]);
    expect(list.categories).toContainEqual({ id: "daily", name: "日用品" });
  });

  it("only propose the parts until confirmed", async () => {
    const res = await call("apply_receipt", { record_id: W1, store: "ライフ", total: 1020, items });
    expect(text(res)).toContain("食費 ¥380（牛乳・食パン）");
    expect(text(res)).toContain("日用品 ¥640（シャンプー）");
    expect(records).toHaveLength(1);
    expect(records[0].needsReview).toBe(true);
  });

  it("split the record into parts that share its receipt, and confirm it", async () => {
    const res = await call("apply_receipt", { record_id: W1, store: "ライフ", total: 1020, items, confirm: true });
    expect(res.isError).toBeFalsy();
    expect(records.map((r) => [r.category, r.amount, r.note, r.receiptId, r.needsReview])).toEqual([
      ["daily", 640, "シャンプー", "r1", false],
      ["food", 380, "牛乳・食パン", "r1", false],
    ]);
    expect(records[0].splitId).toBeTruthy();
    expect(records[1].splitId).toBe(records[0].splitId);
    expect(receiptUpdates).toHaveLength(1);
  });

  it("ask which total to keep when the receipt and the record differ", async () => {
    const asked = await call("apply_receipt", { record_id: W1, total: 1100, items: [...items, { name: "卵", amount: 80, category: "food" }], confirm: true });
    expect(asked.isError).toBe(true);
    expect(records).toHaveLength(1);
    await call("apply_receipt", { record_id: W1, total: 1100, items: [...items, { name: "卵", amount: 80, category: "food" }], use_total: "record", confirm: true });
    expect(records.reduce((s, r) => s + r.amount, 0)).toBe(1020);
  });

  it("record a new payment from a pasted receipt, warning about one already recorded", async () => {
    const preview = await call("add_record", { date: "2026-10-15", store: "ライフ", total: 1020, items });
    expect(text(preview)).toContain(`record_id ${W1}`);
    await call("add_record", { date: "2026-10-15", store: "ライフ", total: 1020, items, confirm: true });
    const added = records.filter((r) => r.id.startsWith("n"));
    expect(added.map((r) => [r.category, r.amount, r.memo, r.receiptId])).toEqual([
      ["daily", 640, "ライフ", undefined],
      ["food", 380, "ライフ", undefined],
    ]);
  });
});

describe("the account check on the receipt tools", () => {
  it("stops every tool when the app is signed in to another account, without reading or writing", async () => {
    for (const [name, input] of [
      ["list_receipts_to_sort", {}],
      ["get_receipt_photo", { record_id: W1 }],
      ["apply_receipt", { record_id: W1, store: "ライフ", total: 1020, items, confirm: true }],
      ["add_record", { store: "ライフ", total: 1020, items, confirm: true }],
    ] as const) {
      const res = await call(name, { ...input, account: "b@example.com" }, "a@example.com");
      expect(res.isError).toBe(true);
      expect(text(res)).toContain("アプリは b@example.com でログインしています");
      expect(text(res)).toContain("https://claude.ai/settings/connectors");
    }
    expect(records).toHaveLength(1);
    expect(records[0].needsReview).toBe(true);
  });

  it("works as usual on the same account", async () => {
    const list = JSON.parse(text(await call("list_receipts_to_sort", { account: "A@example.com" }, "a@example.com")));
    expect(list.records).toHaveLength(1);
  });
});
