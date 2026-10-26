# BrunoでAPIを確認する

`bruno/` をBruno拡張またはデスクトップアプリで開き、環境を選択して `checks` フォルダーを実行する。Basic認証の設定や `.env` は不要。

## 環境

| 環境 | baseUrl | 用途 |
| --- | --- | --- |
| `local` | `http://localhost:5173` | 旧Vite開発API |
| `astro-local` | `http://localhost:4321` | `npm run dev:astro` のAPI |
| `development` | `https://table-notes-astro-development.pandalize.workers.dev` | Astro検証API |
| `production` | `https://pakoirileo.nokishita.app` | 本番API |

設定は `bruno/environments/` で管理する。ポートが変わった場合は `baseUrl` を変更する。

## 確認するリクエスト

| ファイル | 確認内容 |
| --- | --- |
| `checks/health.yml` | 200、status、キャッシュ禁止 |
| `checks/reviews.yml` | 200、口コミの項目・型、訪問年月、最終収集日時 |
| `checks/refresh-unauthorized.yml` | 廃止した取り込みAPIの404 |

口コミ0件・`lastUpdatedAt: null` は未収集時の正常応答。ヘルスチェックはWorkerの応答だけを確認し、D1・Browser Runの正常性までは保証しない。

## 手動取り込み

#34でBasic認証と旧 `POST /api/reviews/refresh` を廃止し、`manual/refresh.yml` と認証変数を撤去した。取り込みはEmDash管理画面の「口コミの取り込み」から実行する。[手順と失敗時の扱い](astro-development.md#管理画面からの手動取り込み34)を参照。

本変更を公開する前の環境は、旧APIとBasic認証が稼働している場合がある。旧APIの404確認は本変更の公開後に行う。

## CLI（任意）

リポジトリ直下から実行する。

```sh
cd bruno
npx --yes @usebruno/cli@4.3.0 run checks --env astro-local
```

## 公式資料

- [VS Code拡張の操作](https://docs.usebruno.com/vs-code-extension/install-config)
- [CLIの実行](https://docs.usebruno.com/bru-cli/run/overview)
