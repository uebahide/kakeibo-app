export const ja = {
  searchPlaceholder: "メモやカテゴリで探す",
  filters: "絞り込み",
  all: "すべて",
  income: "収入",
  /** count and signed total of the filtered records, e.g. 3件・合計 −¥1,200 */
  summary: (n: number, sep: string, total: string) => `${n}件${sep}合計 ${total}`,
  noMatchTitle: "見つかりませんでした",
  noMatchBody: "別の言葉や絞り込みで探してみてください",
  emptyTitle: "この月の記録はありません",
  emptyBody: "「記入」から追加できます",
  daySpent: (amount: string) => `支出 ${amount}`,
};

export const en: typeof ja = {
  searchPlaceholder: "Search memos and categories",
  filters: "Filters",
  all: "All",
  income: "Income",
  summary: (n: number, sep: string, total: string) => `${n} ${n === 1 ? "record" : "records"}${sep}Total ${total}`,
  noMatchTitle: "Nothing found",
  noMatchBody: "Try a different word or filter",
  emptyTitle: "No records this month",
  emptyBody: "Tap “Add” to record one",
  daySpent: (amount: string) => `Spent ${amount}`,
};
