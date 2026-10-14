const ordinal = (n: number) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

export const ja = {
  budgetTitle: "変動費の月の予算",
  budgetTotal: (amount: string) => `合計 ${amount}`,
  budgetHint:
    "入力欄から離れると保存されます。0 にするとそのカテゴリの予算は表示されません。家賃や通信費などの固定費は、ホームの「固定費」で月ごとに設定します。",

  startDayTitle: "月の始まり",
  /** text before and after the day select */
  startDayBefore: "毎月",
  startDayAfter: "日から1か月として集計する",
  startDayOption: (d: number) => String(d),
  startDayReset: "月の始まりを1日に戻しました",
  startDayToast: (d: number) => `毎月${d}日を月の始まりにしました`,
  startDayHint: "給料日に合わせると、予算・固定費・貯金がお給料の周期で区切られます。",
  startDayCalendar: "今はカレンダーどおり（1日〜月末）です。",
  startDayExample: (month: string, range: string) => `たとえば「${month}」は ${range} です。`,

  currencyTitle: "通貨",
  currencyToast: (symbol: string, name: string) => `金額を ${symbol}（${name}）で表示します`,
  currencyHint: "表示の単位だけを切り替えます。入力済みの金額は為替で換算しません。",

  timeZoneTitle: "タイムゾーン",
  timeZoneToast: (name: string) => `${name}で日付を数えます`,
  timeZoneHint: "「今日」がいつかをこの時間で決めます。Claude からの分析も同じ日付で集計します。",

  languageTitle: "言語",
  languageToast: "表示を日本語にしました",
  languageHint: "画面の表示言語です。AI分析の答えもこの言語になります。",

  secretModeTitle: "シークレットモード",

  dataTitle: "データ",
  dataCloud: "記録はクラウドに保存され、スマホとPCのどちらから開いても同じデータが見えます。ほかの人からは見えません。",
  dataLocal:
    "デモモードです。記録はこのブラウザだけに保存されます。Supabase を設定すると、ログインしてスマホとPCで同じデータを使えます。",
  addSamples: "サンプルを入れる",
  deleteSamples: (count: number) => `サンプルを削除${count ? `（${count}件）` : ""}`,
  samplesDeleted: "サンプルを削除しました",
  samplesDeleteFailed: "サンプルを削除できませんでした",

  accountTitle: "アカウント",
  signOut: "ログアウト",
};

export const en: typeof ja = {
  budgetTitle: "Monthly budget for variable costs",
  budgetTotal: (amount: string) => `Total ${amount}`,
  budgetHint:
    "Saved when you leave the field. Set 0 to hide a category's budget. Fixed costs like rent and phone bills are set per month under “Fixed costs” on Home.",

  startDayTitle: "Start of the month",
  startDayBefore: "Count each month from the",
  startDayAfter: "",
  startDayOption: (d: number) => ordinal(d),
  startDayReset: "Months start on the 1st again",
  startDayToast: (d: number) => `Months now start on the ${ordinal(d)}`,
  startDayHint: "Match it to your payday so budgets, fixed costs and savings follow your pay cycle.",
  startDayCalendar: "Right now months follow the calendar (1st to month end).",
  startDayExample: (month: string, range: string) => `For example, “${month}” is ${range}.`,

  currencyTitle: "Currency",
  currencyToast: (symbol: string, name: string) => `Showing amounts in ${symbol} (${name})`,
  currencyHint: "Only changes the display unit. Amounts you've entered aren't converted.",

  timeZoneTitle: "Time zone",
  timeZoneToast: (name: string) => `Counting dates in ${name}`,
  timeZoneHint: "Decides when “today” is. Analysis from Claude uses the same dates.",

  languageTitle: "Language",
  languageToast: "Switched to English",
  languageHint: "The language of the app. AI analysis answers in it too.",

  secretModeTitle: "Secret mode",

  dataTitle: "Data",
  dataCloud: "Your records are saved in the cloud, so you see the same data on your phone and computer. No one else can see them.",
  dataLocal:
    "This is demo mode. Records are saved only in this browser. Set up Supabase to sign in and use the same data on your phone and computer.",
  addSamples: "Add sample data",
  deleteSamples: (count: number) => `Delete sample data${count ? ` (${count} ${count === 1 ? "entry" : "entries"})` : ""}`,
  samplesDeleted: "Sample data deleted",
  samplesDeleteFailed: "Couldn't delete the sample data",

  accountTitle: "Account",
  signOut: "Sign out",
};
