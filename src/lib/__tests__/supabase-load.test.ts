import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OfflineError } from "@/lib/store/offline";
import { createSupabaseStore } from "@/lib/store/supabase";

/** A Supabase client holding `count` records that, like the real API, returns at most `maxRows` rows per request. */
function fakeClient(count: number, maxRows: number, addWhileLoading = false) {
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
      let after: { date: string; id: string } | null = null;
      const query = {
        select: () => query,
        order: () => query,
        or: (filter: string) => {
          const [, date, , id] = filter.match(/^date\.lt\.([\d-]+),and\(date\.eq\.([\d-]+),id\.gt\.(\w+)\)$/)!;
          after = { date, id };
          return query;
        },
        limit: async (n: number) => {
          requests++;
          const rest = after ? sorted.filter((r) => r.date < after!.date || (r.date === after!.date && r.id > after!.id)) : sorted;
          // a record added while loading, dated today: it comes first, ahead of every page
          if (requests === 2 && addWhileLoading) sorted.unshift({ ...sorted[0], id: "new", date: "2026-12-31" });
          return { data: rest.slice(0, Math.min(n, maxRows)), error: null };
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

  it("neither repeats nor skips a record when one is added while loading", async () => {
    const { client } = fakeClient(2500, 1000, true);
    const { transactions } = await createSupabaseStore(client).load();
    expect(transactions).toHaveLength(2500);
    expect(new Set(transactions.map((t) => t.id)).size).toBe(2500);
  });

  it("loads an empty household", async () => {
    const { client } = fakeClient(0, 1000);
    expect((await createSupabaseStore(client).load()).transactions).toEqual([]);
  });

  it("tells a request that never got an answer from one the server turned down", async () => {
    const failing = (status: number) =>
      ({
        from: () => {
          const query = { select: () => query, order: () => query, maybeSingle: async () => ({ data: null, error: null }), limit: async () => ({ data: null, error: { message: "x" }, status }) };
          return query;
        },
      }) as unknown as SupabaseClient;
    await expect(createSupabaseStore(failing(0)).load()).rejects.toBeInstanceOf(OfflineError);
    await expect(createSupabaseStore(failing(401)).load()).rejects.not.toBeInstanceOf(OfflineError);
  });
});
