# 家計簿ノート

スマホで素早く記入でき、PCでも使える自分専用の家計簿です。

- **手早い入力**：金額 → カテゴリを1タップで保存。よく使う記録はワンタップの候補になります。PCでは N キーで入力画面が開きます。
- **予算管理**：今月の支出・予算・今日の目安ペース・1日あたり使える額。カテゴリ別の使いすぎは色で表示。
- **貯金のモチベーション**：貯金目標の進み具合と到達見込み、記録の連続日数、「今日は支出なし」、残り予算を貯金に回すボタン。
- **グラフ分析**：カテゴリ別の円グラフ、予算ペース、6か月の収支推移、曜日ごとの使い方。
- **AI分析**：直近3か月の集計から家計スコア・傾向・節約アクションを出す分析と、家計の相談チャット（Claude API）。

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

## 本番の設定

1. [Supabase](https://supabase.com) でプロジェクトを作り、SQL エディタで `supabase/migrations/0001_init.sql` を実行します。
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

## フォルダ構成

```
src/
  app/            画面（/、/login）、APIルート（/api/ai/*）
  components/     画面の部品（ホーム、履歴、分析、AI分析、設定、入力シート）
  lib/            集計ロジック、カテゴリ、日付、保存先（ブラウザ / Supabase）、Supabase と Claude のクライアント
  proxy.ts        ログイン状態の更新と、未ログイン時の /login への誘導
supabase/migrations/  テーブルと行レベルセキュリティの定義
```
