const records = (n: number) => (n === 1 ? "1 record" : `${n} records`);

export const ja = {
  seeding: "サンプルを入れています…",
  samplesAdded: (n: number) => `サンプルを${n}件入れました`,
  samplesFailed: "サンプルを保存できませんでした",

  emptyTitle: "まだ記録がありません",
  emptyBody: "「記入」から最初の支出をつけてみましょう。雰囲気を見たいときはサンプルデータも入れられます。",
  addSamples: "サンプルを入れる",

  /** the big budget card at the top */
  hero: {
    todayLeft: "今日使える額",
    todayOver: "今日の枠をオーバー",
    openTimeZone: "タイムゾーンの設定を開く",
    /** the big amount line once over: amount is already formatted */
    over: (amount: string) => `${amount} オーバー`,
    spentToday: (amount: string) => `今日の出費 ${amount}`,
    todayLimit: (amount: string) => `/ 今日の枠 ${amount}`,
    perDayFromTomorrow: (amount: string) => `明日からは1日 ${amount}`,
    extraToday: (amount: string) => `ほかに予算外 ${amount}`,
    monthLeft: (month: string) => `${month}の予算の残り`,
    noBudget: "予算未設定",
    spentOfBudget: (spent: string, budget: string) => `使った ${spent} / 予算 ${budget}`,
    paceMark: "今日の目安",
    spare: "予算どおりなら浮くお金",
    spareNeedsIncome: "収入を記録すると出ます",
    breakdown: "内訳",
    revealWithPassword: "パスワードで表示",
    income: "収入",
    fixed: "固定費",
    savingThisMonth: "今月貯金する額",
    variableOver: "変動費（予算超え）",
    variableBudget: "変動費の予算",
    extra: "予算外の支出",
    balanceSoFar: "今日までの収支（貯金後）",
  },

  /** the card listing this month's money */
  money: {
    title: (month: string) => `${month}のお金`,
    income: "収入",
    incomeCount: (n: number) => `${n}件`,
    incomeEmpty: "給料などを記録する",
    fixed: "固定費",
    fixedPaid: (paid: number, total: number) => `支払い済み ${paid}/${total}件`,
    fixedEmpty: "家賃や通信費を登録する",
    saving: "今月貯金する額",
    savedSoFar: (amount: string) => `これまで ${amount}`,
    ofGoal: (percent: number) => `目標の${percent}%`,
    extra: "予算外の支出",
    extraSub: (n: number) => `${n}件`,
    extraNote: "浮くお金から引いています",
    notEntered: "未入力",
  },

  budgets: {
    title: "変動費の予算",
    edit: "予算を編集",
    unused: "まだ使っていない：",
  },

  recent: {
    title: "最近の記録",
    seeAll: "すべて見る",
    empty: "記録はまだありません",
  },

  /** the sheets opened from the cards */
  sheets: {
    today: "今日の出費",
    total: (amount: string) => `合計 ${amount}`,
    totalExtra: (amount: string) => `（うち予算外 ${amount}）`,
    todayEmpty: "今日の出費はまだありません。",
    income: (month: string) => `${month}の収入`,
    incomeEmpty: "この月の収入はまだありません。",
    addIncome: "収入を記入する",
    fixed: (month: string) => `${month}の固定費`,
    saving: (month: string) => `${month}の貯金額`,
    extra: (month: string) => `${month}の予算外の支出`,
    extraNote: (amount: string) => `合計 ${amount}。予算ではなく浮くお金から引いています。`,
    spareLeft: (amount: string) => `浮くお金の残りは ${amount} です。`,
  },

  savings: {
    goalReached: "目標達成です！おめでとうございます",
    saved: (month: string, amount: string) => `${month}の貯金を ${amount} にしました`,
    total: "これまでの貯金",
    changeGoal: "目標を変更",
    setGoal: "目標額を設定",
    goal: (amount: string) => `/ 目標 ${amount}`,
    secret: "シークレットモード中です。解除すると、金額を入れたり変えたりできます。",
    label: (month: string) => `${month}の貯金額（収支から差し引きます）`,
    change: "変更",
    save: "保存",
    moveLeftover: "残り予算を回す",
    moveLeftoverTitle: "今月の変動費の予算の残りを貯金に足す",
  },

  streak: {
    /** text before and after the streak count */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- English needs n for the plural
    days: (n: number): [string, string] => ["記録 ", " 日連続"],
    last7: "直近7日の記録",
    recordedToday: "今日は記録済み",
    noSpend: "今日は支出なし",
    noSpendSaved: "支出なしの日として記録しました",
  },
};

export const en: typeof ja = {
  seeding: "Adding sample records…",
  samplesAdded: (n: number) => `Added ${n === 1 ? "1 sample record" : `${n} sample records`}`,
  samplesFailed: "Couldn't save the sample records",

  emptyTitle: "No records yet",
  emptyBody: "Tap “Add” to record your first expense. Want a feel for the app first? You can add some sample data.",
  addSamples: "Add samples",

  hero: {
    todayLeft: "Left to spend today",
    todayOver: "Over today's allowance",
    openTimeZone: "Open time zone settings",
    over: (amount: string) => `${amount} over`,
    spentToday: (amount: string) => `Spent today ${amount}`,
    todayLimit: (amount: string) => `/ Allowance ${amount}`,
    perDayFromTomorrow: (amount: string) => `From tomorrow: ${amount} a day`,
    extraToday: (amount: string) => `Plus ${amount} outside the budget`,
    monthLeft: (month: string) => `Budget left for ${month}`,
    noBudget: "No budget set",
    spentOfBudget: (spent: string, budget: string) => `Spent ${spent} / Budget ${budget}`,
    paceMark: "Where you'd be on pace today",
    spare: "Money left over if you stick to the budget",
    spareNeedsIncome: "Shows once you record income",
    breakdown: "Breakdown",
    revealWithPassword: "Show with password",
    income: "Income",
    fixed: "Fixed costs",
    savingThisMonth: "Saving this month",
    variableOver: "Variable costs (over budget)",
    variableBudget: "Variable cost budget",
    extra: "Outside the budget",
    balanceSoFar: "Balance so far (after savings)",
  },

  money: {
    title: (month: string) => `Money in ${month}`,
    income: "Income",
    incomeCount: records,
    incomeEmpty: "Record your pay and more",
    fixed: "Fixed costs",
    fixedPaid: (paid: number, total: number) => `${paid}/${total} paid`,
    fixedEmpty: "Add rent, phone bills and more",
    saving: "Saving this month",
    savedSoFar: (amount: string) => `${amount} so far`,
    ofGoal: (percent: number) => `${percent}% of goal`,
    extra: "Outside the budget",
    extraSub: records,
    extraNote: "taken from spare money",
    notEntered: "Not set",
  },

  budgets: {
    title: "Variable cost budget",
    edit: "Edit budget",
    unused: "Not used yet: ",
  },

  recent: {
    title: "Recent records",
    seeAll: "See all",
    empty: "No records yet",
  },

  sheets: {
    today: "Spent today",
    total: (amount: string) => `Total ${amount}`,
    totalExtra: (amount: string) => ` (${amount} outside the budget)`,
    todayEmpty: "Nothing spent today yet.",
    income: (month: string) => `Income in ${month}`,
    incomeEmpty: "No income this month yet.",
    addIncome: "Add income",
    fixed: (month: string) => `Fixed costs in ${month}`,
    saving: (month: string) => `Savings in ${month}`,
    extra: (month: string) => `Outside the budget in ${month}`,
    extraNote: (amount: string) => `Total ${amount}. This comes out of your spare money, not the budget. `,
    spareLeft: (amount: string) => `Spare money left: ${amount}.`,
  },

  savings: {
    goalReached: "Goal reached! Congratulations",
    saved: (month: string, amount: string) => `Set savings for ${month} to ${amount}`,
    total: "Total saved",
    changeGoal: "Change goal",
    setGoal: "Set a goal",
    goal: (amount: string) => `/ Goal ${amount}`,
    secret: "Secret mode is on. Turn it off to enter or change amounts.",
    label: (month: string) => `Savings for ${month} (taken out of your balance)`,
    change: "Update",
    save: "Save",
    moveLeftover: "Save leftover",
    moveLeftoverTitle: "Add what's left of this month's variable cost budget to savings",
  },

  streak: {
    days: (n: number): [string, string] => ["", n === 1 ? " day logged in a row" : " days logged in a row"],
    last7: "Records for the last 7 days",
    recordedToday: "Logged today",
    noSpend: "No spending today",
    noSpendSaved: "Marked today as a no-spend day",
  },
};
