# Astro開発・検証環境（#7）

既存の画面・Hono APIの移行は #8 で行う。#7ではAstroのサーバー実行とReact連携を検証する独立した入口を用意する。

## 構成

- Astro 7、公式Cloudflareアダプター、公式React連携を使用する。
- `astro.config.mjs` は `wrangler.astro.jsonc` を読み込む。
- 開発ルートは `astro/`、ページは `src/pages/`。既存Viteアプリの `index.html` が開発時に優先されないようルートを分離する。
- Worker名は `table-notes-astro-development`、D1は既存の開発用 `table-notes-development`。本番D1・本番ドメインは設定しない。
- 画像変換・セッションはこの段階では使わない。画像用バインディングやKVを自動作成しない。
- `/` にReactのクリック回数を確認できるページを配置する。データベースへの書き込みは行わない。
- D1はリモート接続。ページが表示できても、D1の実在やスキーマを検証したことにはならない。
- Cloudflareアダプターの要件に合わせWranglerを4.152.0へ更新。監査対象だったHonoは互換範囲で更新し、Miniflare内のundiciは修正済み7.30.1に限定して固定する。Miniflareが修正版を採用したら、このoverrideを撤去する。

## 起動・確認

```sh
npm run dev:astro
npm run check:astro
npm run build:astro
npm run preview:astro
```

開発画面で「動作確認」ボタンを押し、回数が増えることを確認する。

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

## 確認結果

- Astroの型チェック・ビルドが成功。
- `dev:astro` で起動し、Astro検証ページのHTMLが返ることを確認。
- `wrangler deploy --dry-run` が成功し、開発用D1だけがバインドされることを確認。
- ビルド済みWorkerをローカル起動し、`GET /` の200応答とReactのHTML出力を確認。
- 既存の型をWranglerで再生成し、既存の型チェック・本番ビルドも成功。
- `astro preview` の `GET /` が200で、Astro検証ページのHTMLが返ることを確認。
- 2026-10-25に検証用Workerへ公開し、公開URLの200応答と、ブラウザのボタン操作で回数が0から1へ増えることを確認。
- 公開バージョン：`9d1d3de2-90cf-43e1-9e66-56aad67ff446`。公開時のバインディングは開発用D1と静的アセットのみ。
- 依存更新後の `npm audit` は0件。旧メジャーへのダウングレードは行っていない。

## 公式仕様

- [Cloudflare連携](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
- [React連携](https://docs.astro.build/en/guides/integrations-guide/react/)
