export const ja = {
  /** prompt filled into a new claude.ai chat; Claude then uses the 家計簿 connector (MCP) */
  claudePrompt:
    "家計簿コネクタの get_weekly_digest で先週の集計を取り、週のふりかえり（一言、使いすぎたカテゴリ、よかった点、今週気をつけること）を短く書いてください。" +
    "最後に save_weekly_review で家計簿アプリに保存してください。",
  title: "先週のふりかえり",
  titleOf: (range: string) => `${range} のふりかえり`,
  close: "閉じる",
  spentOfAllowance: (spent: string, allowance: string) => `${spent} / 使える額 ${allowance}`,
  outsideBudget: (amount: string) => `予算外 ${amount}`,
  overspentTitle: "使いすぎたカテゴリ",
  categoryOver: (spent: string, allowance: string) => `${spent} / 目安 ${allowance}`,
  goodTitle: "よかった点",
  tipsTitle: "今週は",
  nextWeek: (allowance: string, perDay: string) => `今週使える額 ${allowance}（1日 ${perDay}）`,
  readMore: "AI分析で見る",
  sectionTitle: "週のふりかえり",
  sectionLead: "毎週月曜に Claude が先週の集計を読み、使いすぎたカテゴリと今週の目安をまとめてここに届けます。",
  claudeButton: "Claude でふりかえりを作る",
  claudeNote: "届かなかった週は、このボタンで先週の分を作れます。claude.ai に家計簿のコネクタが必要です。",
  empty: "まだふりかえりはありません",
  madeAt: (at: string) => `${at} に Claude が作成`,
  pastTitle: "これまでのふりかえり",
  sample: {
    headline: "予算内でおさまった1週間",
    headlineOver: (category: string) => `${category}が目安を超えた1週間`,
    notes: ["（デモ）週末のまとめ買いと外食が重なりました", "（デモ）買い置きをまとめて買いました"],
    good: "（デモ）平日は1日の目安を守れた日が多かった",
    tip: "（デモ）週末の買い物は先にリストを作ってから出かける",
    cheer: "（デモ）この調子で今週もいきましょう",
  },
};

export const en: typeof ja = {
  claudePrompt:
    "Use get_weekly_digest from the Kakeibo connector to get last week's totals and write a short weekly review (one line, overspent categories, what went well, what to watch this week). " +
    "Finally, save it to the Kakeibo app with save_weekly_review.",
  title: "Last week in review",
  titleOf: (range: string) => `Review of ${range}`,
  close: "Close",
  spentOfAllowance: (spent: string, allowance: string) => `${spent} of ${allowance} to spend`,
  outsideBudget: (amount: string) => `${amount} outside the budget`,
  overspentTitle: "Over their share",
  categoryOver: (spent: string, allowance: string) => `${spent} of ${allowance}`,
  goodTitle: "What went well",
  tipsTitle: "This week",
  nextWeek: (allowance: string, perDay: string) => `${allowance} to spend this week (${perDay} a day)`,
  readMore: "See in AI analysis",
  sectionTitle: "Weekly review",
  sectionLead: "Every Monday Claude reads last week's totals and sends a short review here: what went over, and what to aim for this week.",
  claudeButton: "Write the review in Claude",
  claudeNote: "If a week's review didn't arrive, this writes last week's. Needs the Kakeibo connector in claude.ai.",
  empty: "No reviews yet",
  madeAt: (at: string) => `Written by Claude on ${at}`,
  pastTitle: "Earlier reviews",
  sample: {
    headline: "A week within the budget",
    headlineOver: (category: string) => `${category} went over its share`,
    notes: ["(Demo) A weekend shop and a meal out on the same days", "(Demo) Stocked up on a few things at once"],
    good: "(Demo) Most weekdays stayed within the daily share",
    tip: "(Demo) Make a list before the weekend shop",
    cheer: "(Demo) Keep it up this week",
  },
};
