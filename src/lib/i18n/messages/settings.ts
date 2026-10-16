const ordinal = (n: number) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

export const ja = {
  sectionsLabel: "設定の項目",
  sections: { budget: "予算・カテゴリ", display: "期間と表示", savings: "貯金", links: "連携・データ" },

  budgetTitle: "変動費の月の予算",
  budgetTotal: (amount: string) => `合計 ${amount}`,
  budgetHint:
    "入力欄から離れると保存されます。0 にするとそのカテゴリの予算は表示されません。家賃や通信費などの固定費は、ホームの「固定費」で月ごとに設定します。非表示のカテゴリと固定費のカテゴリはここに出ません。",

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

  weekStartTitle: "週の始まり",
  weekStartMonday: "月曜日",
  weekStartSunday: "日曜日",
  weekStartToast: (day: string) => `週を${day}から数えます`,
  weekStartHint: "ホームの「今週使える額」と、分析の週ごとのグラフをこの曜日で区切ります。",

  currencyTitle: "通貨",
  currencyToast: (symbol: string, name: string) => `金額を ${symbol}（${name}）で表示します`,
  currencyHint: "表示の単位だけを切り替えます。入力済みの金額は為替で換算しません。",

  timeZoneTitle: "タイムゾーン",
  timeZoneToast: (name: string) => `${name}で日付を数えます`,
  timeZoneHint: "「今日」がいつかをこの時間で決めます。Claude からの分析も同じ日付で集計します。",

  languageTitle: "言語",
  languageToast: "表示を日本語にしました",
  languageHint: "画面の表示言語です。AI分析の答えもこの言語になります。",

  autoReadTitle: "レシートの読み取り",
  autoReadOn: "写真を付けたら自動",
  autoReadOff: "ボタンを押したとき",
  autoReadToast: (on: boolean): string => (on ? "レシートの写真を付けたら自動で読み取ります" : "レシートは「Claude で読み取る」を押したときに読み取ります"),
  autoReadHint: "自動にすると、写真を付けたときに合計・カテゴリごとの内訳・店名が入ります。金額は入力済みでもレシートの合計にします。手で分けた内訳はそのまま残します。1枚読むごとに API の費用がかかります。",
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
  sectionsLabel: "Settings sections",
  sections: { budget: "Budget & categories", display: "Periods & display", savings: "Savings", links: "Connections & data" },

  budgetTitle: "Monthly budget for variable costs",
  budgetTotal: (amount: string) => `Total ${amount}`,
  budgetHint:
    "Saved when you leave the field. Set 0 to hide a category's budget. Fixed costs like rent and phone bills are set per month under “Fixed costs” on Home. Hidden and fixed-cost categories aren't listed here.",

  startDayTitle: "Start of the month",
  startDayBefore: "Count each month from the",
  startDayAfter: "",
  startDayOption: (d: number) => ordinal(d),
  startDayReset: "Months start on the 1st again",
  startDayToast: (d: number) => `Months now start on the ${ordinal(d)}`,
  startDayHint: "Match it to your payday so budgets, fixed costs and savings follow your pay cycle.",
  startDayCalendar: "Right now months follow the calendar (1st to month end).",
  startDayExample: (month: string, range: string) => `For example, “${month}” is ${range}.`,

  weekStartTitle: "Week starts on",
  weekStartMonday: "Monday",
  weekStartSunday: "Sunday",
  weekStartToast: (day: string) => `Weeks now start on ${day}`,
  weekStartHint: "Sets where weeks begin for “Left to spend this week” on Home and the weekly chart in Analysis.",

  currencyTitle: "Currency",
  currencyToast: (symbol: string, name: string) => `Showing amounts in ${symbol} (${name})`,
  currencyHint: "Only changes the display unit. Amounts you've entered aren't converted.",

  timeZoneTitle: "Time zone",
  timeZoneToast: (name: string) => `Counting dates in ${name}`,
  timeZoneHint: "Decides when “today” is. Analysis from Claude uses the same dates.",

  languageTitle: "Language",
  languageToast: "Switched to English",
  languageHint: "The language of the app. AI analysis answers in it too.",

  autoReadTitle: "Reading receipts",
  autoReadOn: "When a photo is added",
  autoReadOff: "When I tap the button",
  autoReadToast: (on: boolean) => (on ? "Receipts are read as soon as a photo is added" : "Receipts are read when you tap “Read with Claude”"),
  autoReadHint: "When automatic, adding a photo fills in the total, the parts per category and the shop name. The amount becomes the receipt total even if you entered one; parts you split by hand are kept. Each photo read costs a little API usage.",
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
