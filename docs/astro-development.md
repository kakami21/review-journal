# Astro・EmDash開発・検証環境（#7・#8・#9）

#7のAstro基盤へ#8で既存画面とHono APIを接続し、#9で口コミの保存先をEmDashへ切り替える。本番への切り替えは #11 で行う。

## 構成

- Astro 7、公式Cloudflareアダプター、公式React連携を使用する。
- `astro.config.mjs` は `wrangler.astro.jsonc` を読み込む。
- 開発ルートは `astro/`、ページは `src/pages/`。既存Viteアプリの `index.html` が開発時に優先されないようルートを分離する。
- Worker名は `table-notes-astro-development`、D1は既存の開発用 `table-notes-development`。本番D1・本番ドメインは設定しない。
- 画像・R2は使わない。CMSの認証セッションは専用のSESSION KVへ保存する。
- `/` はホーム、`/reviews` は既存Reactを使う口コミ一覧。`/api/*` だけを既存Honoへ委譲する。`/_emdash/*` はHonoへ渡さない。
- `src/worker/astro.ts` は全リクエストをAstroへ渡し、`src/pages/api/[...path].ts` がCMSコンテキスト内でHonoを呼ぶ。毎分のCronはCMS保守専用で、口コミ収集を呼ばない。
- ローカル開発はローカルD1、検証サイトは開発用リモートD1へ接続する。ページ表示とデータ読み書きの検証は区別する。
- Cloudflareアダプターの要件に合わせWranglerを4.152.0へ更新。監査対象だったHonoは互換範囲で更新し、Miniflare内のundiciは修正済み7.30.1に限定して固定する。Miniflareが修正版を採用したら、このoverrideを撤去する。

## 起動・確認

```sh
npm run dev:astro
npm run check:astro
npm run build:astro
npm run preview:astro
```

`/reviews` で一覧・最終取得日時を確認し、「評価順」「訪問年月順」で並び替えを確認する。

APIの参照確認は `/api/health` と `/api/reviews` を使う。`POST /api/reviews/refresh` はBasic認証が必要。#9以降のAstro側はCMSへ未登録分だけ下書き追加する（後述）。

ローカルのパスワードは `.dev.vars` を使う。ユーザー名はローカル・公開ともに `wrangler.astro.jsonc` の `vars.BASIC_AUTH_USERNAME` を使い、公開パスワードはWorkerの `BASIC_AUTH_PASSWORD` シークレットで管理する。必須シークレット名を設定へ宣言しているため、CIの型生成にローカルの秘密ファイルは不要。認証情報をコードやコマンド引数に書かない。Brunoの環境と設定方法は [API確認手順](bruno.md) を参照。

`build:astro` は `dist/astro/` に出力する。既存の `npm run build` は `dist/` を作り直すため、Astroのプレビュー・公開前は必ず `build:astro` を実行する。

## 検証用Workerへの公開

```sh
npm run build:astro
npx wrangler deploy --config dist/astro/server/wrangler.json --dry-run
npm run deploy:astro
```

生成設定のWorker名が `table-notes-astro-development`、D1名が `table-notes-development`、`routes` が空であることを確認する。検証URLは通常公開されるため、秘密情報をページに表示しない。本番用の `npm run deploy` と区別する。

検証URL：[Astro開発環境](https://table-notes-astro-development.pandalize.workers.dev/)

Astro 7の開発・プレビューはバックグラウンドで起動する。終了する場合は、それぞれ `npx astro dev stop`、`npx astro preview stop` を実行する。

## #7 の確認結果

- Astroの型チェック・ビルドが成功。
- `dev:astro` で起動し、Astro検証ページのHTMLが返ることを確認。
- `wrangler deploy --dry-run` が成功し、開発用D1だけがバインドされることを確認。
- ビルド済みWorkerをローカル起動し、`GET /` の200応答とReactのHTML出力を確認。
- 既存の型をWranglerで再生成し、既存の型チェック・本番ビルドも成功。
- `astro preview` の `GET /` が200で、Astro検証ページのHTMLが返ることを確認。
- 2026-10-25に検証用Workerへ公開し、公開URLの200応答と、ブラウザのボタン操作で回数が0から1へ増えることを確認。
- 公開バージョン：`9d1d3de2-90cf-43e1-9e66-56aad67ff446`。公開時のバインディングは開発用D1と静的アセットのみ。
- 依存更新後の `npm audit` は0件。旧メジャーへのダウングレードは行っていない。

## #8 の確認結果（2026-10-26）

- `/` と `/reviews` が200を返し、ホーム・口コミ38件・最終取得日時をブラウザで確認。評価順で最高評価の店舗が先頭になり、訪問年月順へ戻せることも確認した。
- Astroのルート分離でTailwindの自動検出範囲が変わるため、既存CSSに `@source "../"` を追加した。背景・コンテナ幅・カード・ボタンを含むスタイルを目視確認した。
- `/api/health` と `/api/reviews` は200、未知の `/api/*` は従来のJSONの404。`/_emdash/api/auth` はAstroのHTMLの404となり、Honoには捕捉されない。
- 未認証の更新は401とBasic認証チャレンジを返す。公開設定のユーザー名で認証付き収集を実行し、200・38件の保存と、返却した `scrapedAt` と一覧の `lastUpdatedAt` の一致を確認した。
- 更新前に開発用D1をSQLへエクスポートした。本番D1への書き込み・本番デプロイは行っていない。
- `npm test` の11件でAPI契約、認証拒否、Astroへの委譲範囲、収集失敗時に保存を呼ばず500となることを検証した。失敗はテストで注入しており、外部サイトの障害を実際に発生させたものではない。
- 公開バージョン：`021f24c8-3ede-43c1-945b-6b3f8c8fc44c`。

#2の取得結果の完全性検証、#3のユースケース依存分離、#4のAPI依存分離、#9のCMS導入はこの接続作業では実装しない。既存の全件置換と公開契約を引き継ぎ、これらのIssueは完了扱いにしない。

## 公式仕様

- [Cloudflare連携](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [React連携](https://docs.astro.build/en/guides/integrations-guide/react/)

## EmDashの検証（#9）

Astro側はEmDash 1.3.1の `reviews` コレクションを正本として使う。現行Vite/Hono本番は従来のテーブルを利用し、本番切り替えは #11 で行う。

### ローカル起動

```sh
npx wrangler d1 migrations apply table-notes-development --local --config wrangler.astro.jsonc
npm run dev:astro
```

ローカルのD1・KVは `.wrangler/state` へ保存する。Astroアダプターの `remoteBindings: false` によりリモートD1・Browser Runには接続しない。実際の口コミ収集は検証用Workerで確認する。

`http://localhost:4321/_emdash/admin` から初回セットアップを行い、管理者本人のパスキーを登録する。公開したworkers.devドメインのパスキーとは別に管理する。画像・R2・外部プラグイン・メール認証は今回導入しない。メディア機能は利用しない。

ローカルの開発用DBだけで結合検証する場合：

```sh
npm run test:cms
```

このコマンドは起動済みの `127.0.0.1:4321` に接続し、EmDash公式の開発専用セットアップでテスト管理者を準備する。下書き追加・公開・編集・公開前下書きの非表示・再取得時の編集保護・取得元変更拒否・ゴミ箱再追加防止を実CMS APIで検証する。作成したテスト口コミは最後にゴミ箱へ移す。リモート・本番への接続先指定は受け付けない。実際のパスキー認証の検証とは区別する。

### 取り込みと公開

- `astro/seed/seed.json` が初回のコレクションを定義する。既存DBのスキーマ変更はseedの編集だけでは反映されない。
- `POST /api/reviews/refresh` のBasic認証は維持する。新しい口コミだけを下書き追加し、公開・下書き・ゴミ箱にある既存口コミを上書きしない。
- 応答の `count` は取得件数、`addedCount` は追加件数、`scrapedAt` は全件取り込みが成功した日時。途中失敗は500となり、追加済み下書きは残す。再実行時は登録済みIDを照合する。
- 追加0件でも収集全体が成功すれば `app_review_sync` の成功日時を更新する。失敗時は更新しない。既存SQLとCMSコアマイグレーションを混同しない。
- `source_id` は必須・一意。取得元ID・URL・初回取り込み日時の変更は保存フックで拒否する。
- 管理画面から編集・公開すると `/reviews` と `/api/reviews` に反映される。公開用クエリだけを利用し、公開済みエントリーの編集中の下書きも返さない。
- CMS定期処理は毎分の `createScheduledHandler` に接続する。口コミの定期収集は接続せず、手動更新だけを利用する。開発サーバーのタイマーとCloudflare Cronの実行確認は区別する。

### 検証サイトへの公開

開発用D1をバックアップし、`astro/migrations` を `wrangler.astro.jsonc` で適用してからビルド・公開する。EmDashのコアスキーマとseedは初回リクエストで適用される。管理者登録はサイト所有者が実施する。既存口コミの本番からの移行・自動公開は #11 の作業であり、この段階では行わない。

EmDashの導入で固定されるZodの既知問題を避けるため、互換性のある修正版4.6.7へoverrideしている。上流が修正版を採用したら解除を検討する。
