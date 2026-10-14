import { addMonths, daysInMonth, monthOf, toDateString } from "./date";
import { pick } from "./i18n";
import type { FixedCost, NewTransaction } from "./types";

/** Sample names in the display language, as they are when the samples are added. */
const names = () =>
  pick({
    ja: {
      rent: "家賃", electricity: "電気代", gas: "ガス代", phone: "スマホ", streaming: "動画配信",
      salary: "給与", clothes: "服", supermarket: "スーパー", convenience: "コンビニ", lunch: "ランチ",
      drinks: "飲み会", drugstore: "ドラッグストア", train: "電車", fun: "映画・カフェ",
    },
    en: {
      rent: "Rent", electricity: "Electricity", gas: "Gas", phone: "Phone plan", streaming: "Streaming",
      salary: "Salary", clothes: "Clothes", supermarket: "Supermarket", convenience: "Convenience store", lunch: "Lunch",
      drinks: "Drinks", drugstore: "Drugstore", train: "Train", fun: "Movie / café",
    },
  });

/** Example fixed costs for the last three months; earlier months are fully paid. */
export function makeSampleFixedCosts(now = new Date()): Record<string, FixedCost[]> {
  const day = now.getDate();
  const n = names();
  const items: [string, string, number, number][] = [
    [n.rent, "housing", 78000, 1],
    [n.electricity, "utilities", 9000, 10],
    [n.gas, "utilities", 4000, 12],
    [n.phone, "phone", 3980, 15],
    [n.streaming, "subscription", 1490, 5],
  ];
  const out: Record<string, FixedCost[]> = {};
  for (let k = 2; k >= 0; k--) {
    out[addMonths(monthOf(toDateString(now)), -k)] = items.map(([name, category, amount, payDay]) => ({
      id: crypto.randomUUID(),
      name,
      category,
      amount,
      paid: k > 0 || payDay <= day,
      isSample: true,
    }));
  }
  return out;
}

/** Three months of realistic example records (fixed costs come from makeSampleFixedCosts), marked isSample so they can be removed together. */
export function makeSampleTransactions(now = new Date()): NewTransaction[] {
  const out: NewTransaction[] = [];
  const m = names();
  const rnd = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) / 10) * 10;
  const add = (d: Date, category: string, amount: number, memo: string, type: NewTransaction["type"] = "expense") =>
    out.push({ date: toDateString(d), category, amount, memo, type, isSample: true });

  for (let k = 2; k >= 0; k--) {
    const first = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const ym = toDateString(first).slice(0, 7);
    const last = k ? daysInMonth(ym) : now.getDate();
    const day = (n: number) => new Date(first.getFullYear(), first.getMonth(), n);

    if (last >= 25) add(day(25), "salary", 285000, m.salary, "income");
    if (last >= 20) add(day(20), "clothes", rnd(3000, 9000), m.clothes);

    for (let n = 1; n <= last; n++) {
      const d = day(n);
      const wd = d.getDay();
      const weekday = wd > 0 && wd < 6;
      if (Math.random() < 0.45) add(d, "food", rnd(1800, 4200), m.supermarket);
      if (Math.random() < 0.35) add(d, "food", rnd(200, 800), m.convenience);
      if (weekday && Math.random() < 0.5) add(d, "food", rnd(800, 1300), m.lunch);
      if ((wd === 5 || wd === 6) && Math.random() < 0.5) add(d, "social", rnd(3000, 6500), m.drinks);
      if (Math.random() < 0.15) add(d, "daily", rnd(500, 2500), m.drugstore);
      if (Math.random() < 0.2) add(d, "transport", rnd(200, 900), m.train);
      if (!weekday && Math.random() < 0.3) add(d, "fun", rnd(1500, 4000), m.fun);
    }
  }
  return out;
}
