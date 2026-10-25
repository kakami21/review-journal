# Astro開発・検証環境（#7・#8）

#7で用意したAstro基盤へ、#8で既存画面とHono APIを接続する。本番への切り替えは #11 で行う。

## 構成

- Astro 7、公式Cloudflareアダプター、公式React連携を使用する。
- `astro.config.mjs` は `wrangler.astro.jsonc` を読み込む。
- 開発ルートは `astro/`、ページは `src/pages/`。既存Viteアプリの `index.html` が開発時に優先されないようルートを分離する。
- Worker名は `table-notes-astro-development`、D1は既存の開発用 `table-notes-development`。本番D1・本番ドメインは設定しない。
- 画像変換・セッションはこの段階では使わない。画像用バインディングやKVを自動作成しない。
- `/` はホーム、`/reviews` は既存Reactを使う口コミ一覧。`/api/*` だけを既存Honoへ委譲する。`/_emdash/*` はHonoへ渡さない。
- `src/worker/astro.ts` は画面・APIを振り分ける入口。収集・D1保存・Basic認証は既存実装を再利用する。定期処理も引き継ぐが、新しいCron設定は追加しない。
- D1はリモート接続。ページが表示できても、D1の実在やスキーマを検証したことにはならない。
- Cloudflareアダプターの要件に合わせWranglerを4.152.0へ更新。監査対象だったHonoは互換範囲で更新し、Miniflare内のundiciは修正済み7.30.1に限定して固定する。Miniflareが修正版を採用したら、このoverrideを撤去する。

## 起動・確認

```sh
npm run dev:astro
npm run check:astro
npm run build:astro
npm run preview:astro
```

`/reviews` で一覧・最終取得日時を確認し、「評価順」「訪問年月順」で並び替えを確認する。

APIの参照確認は `/api/health` と `/api/reviews` を使う。`POST /api/reviews/refresh` はBasic認証が必要で、収集成功後に開発用D1を全件置換する。CMSへの追加のみの取り込みは #9 で実装する。

ローカル認証は `.dev.vars` を使う。公開環境のユーザー名は `wrangler.astro.jsonc` の `BASIC_AUTH_USERNAME`、パスワードはWorkerの `BASIC_AUTH_PASSWORD` シークレットで管理する。認証情報をコードやコマンド引数に書かない。Brunoの環境と設定方法は [API確認手順](bruno.md) を参照。

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
