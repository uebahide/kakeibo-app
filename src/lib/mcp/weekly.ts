import "server-only";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { inCategories } from "@/lib/categories";
import { inTimeZone } from "@/lib/date";
import { inLanguage } from "@/lib/i18n";
import { createSupabaseStore } from "@/lib/store/supabase";
import { weekStartOf } from "@/lib/week";
import { buildWeeklyDigest, reviewFrom, withFigures } from "@/lib/weeklyReview";
import { z } from "zod";
import { accountInput as account, accountMismatch, supabaseFor } from "./auth";

// Claude's weekly review: get_weekly_digest gives a finished week's totals, Claude writes the review,
// and save_weekly_review keeps it for the app's home and AI analysis screens.

const WEEKLY_NOTE =
  "金額の単位は currency。week は振り返る週（start〜end、weekStartsOn 始まり）で、allowance はその週に使えた額、spent は予算内の支出、outsideBudget は予算外の支出。" +
  "byCategory はカテゴリごとの予算内の支出で、allowance は月の予算をその週の日数分に割った目安（予算がなければ null）、averageOfPastWeeks はその前の4週の平均。" +
  "topItems はその週のお店・メモごとの合計、pastWeeks はその前の4週、nextWeek は次の週（先週を振り返るときは今週）の使える額と1日あたり、month は今月の予算と支出。" +
  "カテゴリ名と曜日は language の言語（ja＝日本語、en＝英語）。文章は language の言語で書く。" +
  " Amounts are in `currency`. `week` is the week to review (`start` to `end`, starting on `weekStartsOn`): `allowance` is what it could spend, `spent` the budgeted spending, `outsideBudget` spending outside the budget." +
  " `byCategory` is budgeted spending per category; its `allowance` is the monthly budget's share for those 7 days (null without a budget), `averageOfPastWeeks` the average of the 4 weeks before." +
  " `topItems` totals the week by shop or memo, `pastWeeks` are the 4 weeks before, `nextWeek` is the following week (the current one, when reviewing last week) with its allowance and per-day share, `month` the current month's budget and spending." +
  " Category and weekday names are in `language` (ja = Japanese, en = English); write in that language.";

const weekStartInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .describe("振り返る週の初日（YYYY-MM-DD）。省略すると終わった直近の週 / First day (YYYY-MM-DD) of the week to review; by default the last week that is over");

const ReviewSchema = {
  headline: z.string().min(1).max(120).describe("その週を一言で（30字以内）/ The week in one line (60 English characters or fewer)"),
  overspent: z
    .array(
      z.object({
        category: z.string().min(1).max(40).describe("byCategory の category をそのまま / A `category` from byCategory, as is"),
        note: z.string().min(1).max(240).describe("何が多かったか。topItems の数字を引用（60字以内）/ What drove it, quoting topItems (120 English characters or fewer)"),
      }),
    )
    .max(3)
    .describe("allowance を超えたカテゴリ（多い順、最大3つ）。なければ空 / Categories over their allowance, largest first, up to 3; empty if none"),
  good: z.array(z.string().min(1).max(200)).min(1).max(2).describe("よかった点 1〜2つ（各50字以内）/ 1-2 things that went well (100 English characters or fewer each)"),
  tips: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(2)
    .describe("次の週に気をつけることと具体的な一手 1〜2つ（nextWeek の額にふれてよい）/ 1-2 concrete things to do next week (may cite nextWeek's amounts)"),
  cheer: z.string().min(1).max(200).describe("励ましの一言（50字以内）/ One encouraging line (100 English characters or fewer)"),
};

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ isError: true, content: [{ type: "text" as const, text }] });

/** The week's digest, in the user's time zone, language and categories (the server runs in UTC). */
async function digestFor(ctx: ServerContext, weekStart: string | undefined) {
  const supabase = supabaseFor(ctx);
  const { transactions, settings } = await createSupabaseStore(supabase).load();
  const digest = inLanguage(settings.language ?? "ja", () =>
    inTimeZone(settings.timeZone, () =>
      inCategories(settings.categories, () =>
        // A date in the middle of a week counts as that week.
        buildWeeklyDigest(transactions, settings, weekStart ? weekStartOf(weekStart, settings.weekStartDay) : undefined),
      ),
    ),
  );
  return { supabase, digest };
}

export function registerWeeklyTools(server: McpServer) {
  server.registerTool(
    "get_weekly_digest",
    {
      title: "家計簿の週の集計を取得",
      description:
        "終わった週（既定は先週）の集計を JSON で返す。週のふりかえりを書く前に呼ぶ。1件ずつの記録ではなく合計だけを返す。" +
        WEEKLY_NOTE,
      inputSchema: z.object({ account, weekStart: weekStartInput }),
      annotations: { readOnlyHint: true },
    },
    async ({ account, weekStart }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return fail(mismatch);
      const { digest } = await digestFor(ctx, weekStart);
      return ok(JSON.stringify(digest));
    },
  );

  server.registerTool(
    "save_weekly_review",
    {
      title: "週のふりかえりを家計簿に保存",
      description:
        "週のふりかえりを家計簿アプリ（ホームと「AI分析」画面）に保存する。同じ週のふりかえりは上書きされる。" +
        "get_weekly_digest の数字にもとづいて書いてから呼ぶ。週の合計と使いすぎたカテゴリの金額はアプリが集計から入れる。" +
        "文章はダイジェストの language の言語で書く。" +
        " Saves a weekly review to the Kakeibo app (home and AI analysis screens), replacing one for the same week. Write it from get_weekly_digest first;" +
        " the app fills in the week's totals and the overspent categories' amounts. Write every text in the digest's `language`.",
      inputSchema: z.object({ account, weekStart: weekStartInput, ...ReviewSchema }),
    },
    async ({ account, weekStart, ...text }, ctx) => {
      const mismatch = accountMismatch(ctx, account);
      if (mismatch) return fail(mismatch);
      const { supabase, digest } = await digestFor(ctx, weekStart);
      const filled = withFigures(text, digest);
      if (filled.unknown.length) {
        const names = digest.byCategory.map((c) => c.category).join(", ");
        return fail(`このカテゴリは週の集計にありません: ${filled.unknown.join(", ")}。byCategory の名前から選んでください（${names}）。 / Not in the week's digest: ${filled.unknown.join(", ")}. Use names from byCategory (${names}).`);
      }
      const review = reviewFrom(digest, filled.text, "claude");
      const { error } = await supabase
        .from("weekly_reviews")
        .upsert(
          { user_id: ctx.http?.authInfo?.extra?.userId, week_start: review.weekStart, review, created_at: review.at },
          { onConflict: "user_id,week_start" },
        );
      if (error) {
        const hint = error.message.includes("weekly_reviews") ? " Supabase で 0016_weekly_reviews.sql を実行してください。/ Run 0016_weekly_reviews.sql in Supabase." : "";
        return fail(`保存できませんでした / Couldn't save: ${error.message}.${hint}`);
      }
      return ok("保存しました。家計簿アプリのホームと「AI分析」画面で見られます。/ Saved. It's shown on the Kakeibo app's home and AI analysis screens.");
    },
  );
}
