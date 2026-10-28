# Astro・EmDash開発・検証環境（#7・#8・#9）

#7のAstro基盤へ#8で既存画面とHono APIを接続し、#9で口コミの保存先をEmDashへ切り替える。本番への切り替えは #11 で行う。

## 構成

- Astro 7、公式Cloudflareアダプター、公式React連携を使用する。
- `astro.config.mjs` は `wrangler.astro.jsonc` を読み込む。
- 開発ルートは `astro/`、ページは `src/pages/`。通常のnpmコマンドはAstro CLIを起動する。
- Worker名は `table-notes-astro-development`、D1は既存の開発用 `table-notes-development`。本番D1・本番ドメインは設定しない。
- CMSの画像は環境ごとに分けたR2へ保存する。CMSの認証セッションは専用のSESSION KVへ保存する。
- `/` はホーム、`/reviews` は既存Reactを使う口コミ一覧。`/api/*` だけを既存Honoへ委譲する。`/_emdash/*` はHonoへ渡さない。
- `src/worker/astro.ts` は全リクエストをAstroへ渡し、`src/pages/api/[...path].ts` がCMSコンテキスト内でHonoを呼ぶ。毎分のCronはCMS保守専用で、口コミ収集を呼ばない。
- ローカルDBは使用せず、ローカル開発・検証サイトとも開発用リモートD1 `table-notes-development` へ接続する。書き込みは両方に反映され、本番D1とは分離する。開発時のR2も開発用リモートバケット `table-notes-media-development` へ接続し、本番用 `dining-archive-media` と分離する。
- Cloudflareアダプターの要件に合わせWranglerを4.152.0へ更新。監査対象だったHonoは互換範囲で更新し、Miniflare内のundiciは修正済み7.30.1に限定して固定する。Miniflareが修正版を採用したら、このoverrideを撤去する。

## 起動・確認

```sh
npm run dev
npm run check
npm run build
npm run preview
```

`/reviews` で一覧・最終取得日時を確認し、「評価順」「訪問年月順」で並び替えを確認する。

APIの参照確認は `/api/health` と `/api/reviews` を使う。手動取り込みはEmDash管理画面の「口コミの取り込み」から実行する。旧 `POST /api/reviews/refresh` は廃止し、404を返す。

取り込みの認証はCMSのパスキー認証に一本化した。Basic認証のユーザー名・パスワード設定は不要。Brunoは参照APIと旧APIの廃止確認に使う（[API確認手順](bruno.md)）。

`npm run build` は開発用設定で `dist/astro/` に出力する。`npm run build:production` だけが本番設定で `dist/astro-production/` に出力する。

## 検証用Workerへの公開

```sh
npm run build
npx wrangler deploy --config dist/astro/server/wrangler.json --dry-run
npx wrangler deploy --config dist/astro/server/wrangler.json
```

生成設定のWorker名が `table-notes-astro-development`、D1名が `table-notes-development`、`routes` が空であることを確認する。検証URLは通常公開されるため、秘密情報をページに表示しない。本番用の `npm run deploy` と区別する。

検証URL：[Astro開発環境](https://table-notes-astro-development.pandalize.workers.dev/)

Astro 7の開発・プレビューはバックグラウンドで起動する。終了する場合は、それぞれ `npx astro dev stop`、`npx astro preview stop` を実行する。

## #7 の確認結果

- Astroの型チェック・ビルドが成功。
- Astro開発サーバーで起動し、Astro検証ページのHTMLが返ることを確認。
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

Astro側はEmDash 1.3.1の `reviews` コレクションを正本として使う。本番切り替えは #11 で完了している。

### ローカル起動

```sh
npx wrangler d1 migrations apply table-notes-development --remote --config wrangler.astro.jsonc
npm run dev
```

D1・Browser Run・R2はリモート接続する。Astroアダプターの `remoteBindings: true` とWranglerの対象バインディングの `remote: true` を使用する。SESSION KVはローカルで模擬し、`.wrangler/state` へ保存する。

`http://localhost:4321/_emdash/admin` から初回セットアップを行い、管理者本人のパスキーを登録する。公開したworkers.devドメインのパスキーとは別に管理する。写真は開発用R2へ保存し、本番用バケットへは書き込まない。保存と配信の手順は[投稿写真の手順](post-photos.md)を参照する。

ローカル起動したアプリを通して開発用リモートDBで結合検証する場合：

```sh
npm run test:cms
```

この検証はVitestを明示実行し、検証サイトと共有する開発用リモートDBへテストデータを書き込みます。通常の `npm test` からは除外される。起動済みの `127.0.0.1:4321` に接続し、EmDash公式の開発専用セットアップでテスト管理者を準備する。未起動や認証失敗はテスト失敗として表示する。下書き追加・公開・編集・公開前下書きの非表示・再取得時の編集保護・取得元変更拒否・ゴミ箱再追加防止を実CMS APIで検証する。作成したテスト口コミは最後にゴミ箱へ移す。別ポートで起動した場合は `CMS_TEST_PORT=4322 npm run test:cms` とする。指定できるのはローカルのポート番号だけで、公開サイトのURLは受け付けないが、接続先DBは開発用リモートD1となる。実際のパスキー認証の検証とは区別する。

### 取り込みと公開

- `astro/seed/seed.json` が初回のコレクションを定義する。既存DBのスキーマ変更はseedの編集だけでは反映されない。
- 管理画面の「口コミの取り込み」を開き、「口コミを取り込む」を押す。新しい口コミだけを下書き追加し、公開・下書き・ゴミ箱にある既存口コミを上書きしない。
- 応答の `count` は取得件数、`addedCount` は追加件数、`scrapedAt` は全件取り込みが成功した日時。途中失敗は500となり、追加済み下書きは残す。再実行時は登録済みIDを照合する。
- 追加0件でも収集全体が成功すれば `app_review_sync` の成功日時を更新する。失敗時は更新しない。既存SQLとCMSコアマイグレーションを混同しない。
- `source_id` は必須・一意。取得元ID・URL・初回取り込み日時の変更は保存フックで拒否する。
- 管理画面から編集・公開すると `/reviews` と `/api/reviews` に反映される。公開用クエリだけを利用し、公開済みエントリーの編集中の下書きも返さない。
- CMS定期処理は毎分の `createScheduledHandler` に接続する。口コミの定期収集は接続せず、手動更新だけを利用する。開発サーバーのタイマーとCloudflare Cronの実行確認は区別する。

### 検証サイトへの公開

開発用D1をバックアップし、`astro/migrations` を `wrangler.astro.jsonc` で適用してからビルド・公開する。EmDashのコアスキーマとseedは初回リクエストで適用される。管理者登録はサイト所有者が実施する。既存口コミの本番からの移行・自動公開は #11 の作業であり、この段階では行わない。

EmDashの導入で固定されるZodの既知問題を避けるため、互換性のある修正版4.6.7へoverrideしている。上流が修正版を採用したら解除を検討する。

### #9 の実装時の確認（2026-10-26）

- 単体テスト42件、ローカル実CMSの結合検証、Astroと現行Viteの型チェック・ビルドが成功。依存監査は0件。
- 開発用D1をバックアップ後、CMSを検証用Workerへ公開。バージョンは `ae4736fe-54a0-4c6a-a2d3-072619af9695`。
- 実Browser Runによる認証付き更新は200。取得38件を38件の下書きとして追加し、一般向け一覧は0件・成功した収集日時を返す。
- 未認証のCMS管理APIは401。Cloudflareの毎分Cronは例外・エラーログなしで実行された。
- 本人がパスキー登録を完了し、認証済みの管理画面から編集・下書き保存・公開・再公開が成功。公開済み内容の編集中下書きが一般向けAPIへ漏れないことも確認した。

### #9 の最終確認（2026-10-26）

- 検証サイトで1件を公開し、Reactの口コミ一覧とAPIに反映されることを確認。確認用のタイトル変更は元に戻した。現在は公開1件・下書き37件。
- 公開後の実収集は取得38件・追加0件となり、公開内容と登録件数を保持し、成功日時だけが更新された。
- ローカル実CMSで同じ取得元IDの並行取り込みを実行し、合計追加1件となることを確認。途中失敗・再実行は単体テストでも検証した。
- ライブビューのURLパターンを `/reviews#{slug}` とし、口コミカードに食べログIDのアンカーを追加。既存の検証DBでは管理画面のコンテンツタイプ設定も同じ値へ更新済み。
- 修正後の検証用Worker：`0e6395c2-50b8-4642-82f1-ceac8d300d62`。本番切り替えは #11 で扱う。

## APIの依存分離と検証（#4）

- `src/pages/api/[...path].ts` は環境設定を受けてHonoへ渡す入口に限定する。CMSの公開クエリ・収集・保存の接続は `src/cms/review-api-dependencies.ts`、認証とHTTP応答は既存の `src/worker/review-api.ts` が担当する。
- `npm test` の `tests/cms-review-api.test.ts` はAstroの実API入口を通し、CMS・DB・Browser Runとの境界だけをテスト用に置き換える。公開版だけのページ送り、ID・null・日時・並び順、公開一覧失敗の共通500、旧取り込みAPIと未知APIの404を検証する。取り込みの認証・失敗・保存は `tests/review-import.test.ts` と既存のCMSテストで検証する。
- #34で手動取り込みをCMS管理者認証へ一本化。旧Basic認証付きAPIは廃止し、ヘルスチェックや旧APIへの呼び出しでは収集・保存を開始しない。
- AstroのCronはCMS保守専用のままとし、口コミ収集は接続しない。口コミ収集は管理画面からの手動取り込みに限定する。
- `tests/astro-worker.test.ts` でAstroへの委譲とCMS保守Cronを確認する。実CMSの公開・非公開状態の保護は#9の結合検証と区別する。

### #4 の確認結果（2026-10-26）

- テスト66件、Astro・現行Viteの型チェック／ビルドが成功。
- ローカルAstroで `/`・`/reviews`・`/_emdash/admin` はHTMLの200、`/_emdash/api/unknown` はCMS側の401となり、アプリAPIの404へ捕捉されないことを確認。
- `/api/health` は200、未知の `/api/*` はアプリAPIのJSONの404、未認証の更新POSTはBasic認証チャレンジ付き401を確認。
- 検証用Workerへの再公開、実Browser Runでの収集、本番変更は未実施。API内部の失敗はテストで注入し、実外部サービスの障害を発生させたものではない。

## 管理画面からの手動取り込み（#34）

1. `/_emdash/admin` で管理者のパスキーを使ってログインする。
2. サイドバーの「口コミの取り込み」を開き、「口コミを取り込む」を押す。
3. 実行中は画面を開いたまま待つ。ボタンは無効になり、連打では追加のリクエストを送信しない。
4. 完了後に取得件数・新規追加件数・成功日時（日本時間）を確認する。追加0件も成功。取得0件は不完全な取得として失敗にする。
5. 「口コミ一覧を開く」で追加された下書きを確認し、必要な編集と公開を行う。取り込みだけでは公開されない。

取得失敗では保存を開始しない。保存失敗では一部の下書きが残る可能性がある。再実行すると既存の取得元IDを除外して続行する。通信切断で結果不明の場合も処理が進んでいる可能性があるため、しばらく待って一覧を確認してから再実行する。自動再試行はしない。

実行入口は `POST /_emdash/api/plugins/review-import/run`。EmDash標準の管理者権限（`plugins:manage`）・認証・CSRF検証を使う。ブラウザは標準の `apiFetch()` を使用する。GET等は405となる。旧 `/api/reviews/refresh` は認証情報の有無に関係なく404となる。

ローカル起動でもBrowser Runへリモート接続する。登録済みの検証サイト用パスキーによる実収集の成功確認は検証用Workerで行う。AstroのCMS保守Cronは口コミ収集を実行しない。

Basic認証の設定・型定義・Bruno認証変数・手動更新リクエストは撤去済み。公開済みWorkerのシークレットは、各環境への本変更の公開と動作確認後に削除する。旧バージョンへの復旧時に必要となるため、公開前には削除しない。本番の削除は本番リリース時に実施する。
