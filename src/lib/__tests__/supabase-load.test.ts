import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseStore } from "@/lib/store/supabase";

/** A Supabase client holding `count` records that, like the real API, returns at most `maxRows` rows per request. */
function fakeClient(count: number, maxRows: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `r${String(i).padStart(5, "0")}`,
    // a few records per day, so many share a date and the tie-break by id matters
    date: `2026-${String(1 + Math.floor(i / 280)).padStart(2, "0")}-${String(1 + (Math.floor(i / 10) % 28)).padStart(2, "0")}`,
    amount: 100,
    type: "expense",
    category: "food",
    memo: "",
    is_sample: false,
    created_at: "2026-01-01T00:00:00Z",
  }));
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  let requests = 0;
  const client = {
    from(table: string) {
      if (table === "user_settings") return { select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) };
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          requests++;
          return { data: sorted.slice(from, Math.min(to + 1, from + maxRows)), error: null };
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, requests: () => requests };
}

describe("loading the signed-in user's records", () => {
  it("reads every record when there are more than one request returns", async () => {
    const { client, requests } = fakeClient(2500, 1000);
    const { transactions } = await createSupabaseStore(client).load();
    expect(transactions).toHaveLength(2500);
    expect(new Set(transactions.map((t) => t.id)).size).toBe(2500);
    expect(requests()).toBe(4);
  });

  it("still reads every record when the API returns fewer rows than asked for", async () => {
    const { client } = fakeClient(1234, 300);
    const { transactions } = await createSupabaseStore(client).load();
    expect(transactions).toHaveLength(1234);
    expect(transactions[0].date >= transactions.at(-1)!.date).toBe(true);
  });

  it("loads an empty household", async () => {
    const { client } = fakeClient(0, 1000);
    expect((await createSupabaseStore(client).load()).transactions).toEqual([]);
  });
});
