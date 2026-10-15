# 家計簿ノート

スマホで素早く記入でき、PCでも使える自分専用の家計簿です。

- **手早い入力**：金額 → カテゴリを1タップで保存。よく使う記録はワンタップの候補になります。PCでは N キーで入力画面が開きます。
- **予算管理**：予算は変動費だけに設定し、今日の目安ペースと1日あたり使える額を表示。カテゴリ別の使いすぎは色で表示。
- **月の始まり**：給料日に合わせて、毎月何日から1か月とするかを設定できます（例：5日なら「10月」は 10/5〜11/4）。
- **予算外の支出**：旅行やイベントなど、予算とは別の出費は「予算外」として記録できます。予算ではなく「予算どおりなら浮くお金」から引かれ、ホームにまとめて表示されます。
- **固定費**：家賃や通信費などを月ごとに登録すると、自動でその月の支出に入ります。翌月は前の月の内容が初期値になり、項目ごとに支払い済みをチェックできます。
- **貯金**：毎月の貯金額を入れると、その月の収支から差し引かれ、これまでの貯金に積み上がります。目標額は任意で、設定すると進み具合と到達見込みを表示。記録の連続日数、「今日は支出なし」、残り予算を貯金に回すボタンも。
- **グラフ分析**：カテゴリ別の円グラフ、予算ペース、6か月の収支推移、曜日ごとの使い方。
- **AI分析**：直近3か月の集計から家計スコア・傾向・節約アクションを出す分析と、家計の相談チャット（Claude API）。
- **iPhoneの自動記入**：ウォレット（Apple Pay）でカードを使うと、ショートカットのオートメーションが支払いを送り、自動で記入します。以前に確定した店は同じカテゴリで、初めての店はカテゴリを推測して「要確認」として入り、ホームでワンタップで確定できます。
- **日本語・英語**：設定の「言語」で表示を切り替えられます。未選択のときはブラウザの言語に従い、AI分析の答えも選んだ言語になります。

## 技術構成

- Next.js 16（App Router）+ TypeScript + Tailwind CSS v4
- Supabase（メールアドレスとパスワードでのログインと、データの保存。行レベルセキュリティで本人のデータだけに制限）
- Claude API（`@anthropic-ai/sdk`。APIキーはサーバー側の Route Handler だけで使用）
- Recharts（グラフ）
- PWA 用の Web App Manifest（ホーム画面に追加できます）

## すぐ試す（デモモード）

Supabase を設定しなくても、記録をブラウザに保存するデモモードで動きます。

```bash
npm install
npm run dev
```

http://localhost:3000 を開き、「サンプルを入れる」で3か月分の例を入れられます。
AI分析を試すときは `.env.local` に `ANTHROPIC_API_KEY` を入れてください（デモモードのAIは開発環境でだけ動きます）。

## テスト

何を確かめているかの一覧は [docs/testing.md](docs/testing.md) にあります。

集計（期間、予算、ペース、固定費、貯金）と金額の読み取りのテストがあります。GitHub では PR ごとに lint と一緒に実行されます。

```bash
npm test          # 1回実行
npm run test:watch  # 変更のたびに実行
```

画面のテスト（`e2e/`）は Playwright で、デモモードのアプリを本物のブラウザで開き、記入・編集・削除、分析画面、月の切り替え、言語の切り替えなどを iPhone 幅と PC 幅の両方で確かめます。「今日」は 2026年10月15日に固定しています。

```bash
npx playwright install chromium  # 初回だけ
npm run test:e2e
```

## 本番の設定

1. [Supabase](https://supabase.com) でプロジェクトを作り、SQL エディタで `supabase/migrations/` の SQL を番号順（`0001_init.sql`、`0002_fixed_costs.sql`、`0003_outside_budget.sql`、`0004_month_start_day.sql`、`0005_currency.sql`、`0006_time_zone.sql`、`0007_language.sql`、`0008_wallet_import.sql`）に実行します。
2. ログイン用のアカウントを Supabase で作ります。アプリには新規登録画面がないので、知らない人は登録できません。
   - Authentication → Users →「Add user」→「Create new user」で、メールアドレスとパスワードを入れ、「Auto Confirm User」にチェックを入れて作成
   - Authentication の設定で「Allow new users to sign up」をオフにしておくと、より安全です
3. `.env.example` を `.env.local` にコピーして値を入れます（Vercel では環境変数に同じ値を設定）。

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase の Publishable key（旧 anon key でも可） |
| `ANTHROPIC_API_KEY` | Claude API のキー |
| `ANTHROPIC_MODEL` | 任意。使うモデル（既定は `claude-opus-5-5`） |

4. Claude（claude.ai）のコネクタから家計簿を使う場合は、Supabase の OAuth サーバーを設定します。
   - Authentication → OAuth Server で OAuth サーバーを有効にし、Authorization Path を `/oauth/consent`、Dynamic client registration をオンにする
   - Authentication → URL Configuration の Site URL をアプリの本番 URL にする
   - claude.ai の 設定 → コネクタ →「カスタムコネクタを追加」で `https://<本番のドメイン>/api/mcp` を登録し、表示される同意画面で「許可する」

5. iPhoneの自動記入を使う場合は、アプリの 設定 →「iPhoneの自動記入」で連携キーを発行し、そこに出る手順どおりにショートカットの「取引」オートメーションを作ります。支払いは `POST /api/import/wallet` に `Authorization: Bearer <連携キー>` と JSON `{ "amount": "2 500 Ft", "merchant": "LIDL" }` で送られます（金額は文字のままでも数値でも可、通貨は文字から読み取ります）。

## フォルダ構成

```
src/
  app/            画面（/、/login、/oauth/consent）、APIルート（/api/ai/*、/api/mcp、/api/import/wallet）
  components/     画面の部品（ホーム、履歴、分析、AI分析、設定、入力シート）
  lib/            集計ロジック、カテゴリ、日付、保存先（ブラウザ / Supabase）、Supabase と Claude のクライアント
  lib/i18n/       日本語・英語の文言（messages/ に画面ごとの辞書。英語の訳し忘れは型エラーになる）
  lib/__tests__/  集計ロジックのテスト（Vitest）
  proxy.ts        ログイン状態の更新と、未ログイン時の /login への誘導
supabase/migrations/  テーブルと行レベルセキュリティの定義
e2e/              画面のテスト（Playwright）
```
