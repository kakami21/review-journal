# table-notesの本番リリース設定・手順

CI、タグ公開、公開後確認、GitHub Releases、DB変更、復旧の運用は[共通リリース規則](rules/release.md)に従う。この文書は本プロジェクトの対象とコマンドを具体化する。

## 対象と初回設定

| 項目 | 設定 |
| --- | --- |
| 本番Worker | `dining-archive` |
| 本番D1 | `dining-archive-db` |
| 公開URL | `https://pakoirileo.nokishita.app` |
| Wrangler設定 | `wrangler.astro.production.jsonc` |
| GitHub Environment | `production` |
| Environment secret | `CLOUDFLARE_API_TOKEN` |
| 取り込みの認証 | EmDash管理者のパスキー・セッション |
| CIワークフロー | `.github/workflows/ci.yml` |
| 公開ワークフロー | `.github/workflows/release.yml` |
| 本番公開のconcurrencyグループ | `production-release` |

Cloudflareの本番Worker → Settings → Buildsでmain連携の停止を確認する。Environmentのタグ制限・公開用トークン・秘密値の扱いは共通規則に従って設定する。
取り込み用のBasic認証は#34で廃止。旧 `BASIC_AUTH_PASSWORD` シークレットは本変更の公開と管理画面の取り込み確認後に、対象Workerを確認して削除する。公開前や旧構成が利用中の環境では削除しない。

初回設定の確認状況と公開結果は[Issue #23](https://github.com/kakami21/table-notes/issues/23)へ記録する。
Astro検証用Workerへの公開コマンドは使わない。初回切り替えは[本番移行手順](production-migration.md)に従う。

## 公開後の確認

Actionsの`Release`を開き、Summaryのタグ・コミット・Workerバージョンを確認する。
ワークフローのヘルスチェックは`/api/health`のHTTP 200と`status: ok`を検証する。口コミ一覧も確認する。

公開HTMLに埋め込んだバージョンは、開発者ツールのConsoleで確認できる。

```js
document.querySelector('meta[name="release-version"]').content
```

## Astro本番化の準備

初回切り替えは [本番移行手順](production-migration.md) に従う。SESSION KVは本番専用の `d3419d12971c4d3ca72503b4d3674016` を使う。

ReleaseはCMSスキーマの適用済み状態を `emdash migrate --check` で確認してから公開する。GitHubのトークンには対象アカウントのD1読み取り権限も必要。未適用なら公開前に停止する。スキーマ適用は自動化しない。

```sh
ASTRO_ENV=production npm run build:astro
npx emdash migrate --manifest astro/.emdash/migrations.json --wrangler-config wrangler.astro.production.jsonc --status
npx emdash migrate --manifest astro/.emdash/migrations.json --wrangler-config wrangler.astro.production.jsonc
npx emdash migrate --manifest astro/.emdash/migrations.json --wrangler-config wrangler.astro.production.jsonc --check
```

適用担当者の `CLOUDFLARE_API_TOKEN` にはD1編集権限が必要。CLIの対象アカウント・DB・確認内容を確認して適用する。非対話実行はCLIで確認した対象フィンガープリントを指定する。CMSの本番実行時は `runtime: check` により未適用スキーマを自動変更せず503で停止する。コレクションとフィールドはアプリのEmDash設定で初期化する。

## D1の操作

本番D1の適用状態とバックアップを確認し、必要な変更がある場合だけ、共通規則の順序で実行する。

```sh
npx wrangler d1 migrations list dining-archive-db --remote --config wrangler.astro.production.jsonc
npx wrangler d1 export dining-archive-db --remote --config wrangler.astro.production.jsonc --output /安全な保存先/backup.sql
npx wrangler d1 migrations apply dining-archive-db --remote --config wrangler.astro.production.jsonc
```

復旧用の旧構成の一覧APIには`review_list`ビューが必要。`/api/health`の成功だけでは、そのビューや一覧APIの正常性を保証しない。

## 復旧時のコマンド

Summary・ログ・CloudflareのDeploymentsで公開状態とバージョンを確認する。
コードを戻す場合は、共通規則に従い正常だったWorkerバージョンIDを指定する。

```sh
npx wrangler deployments list --config wrangler.astro.production.jsonc
npx wrangler rollback <正常だったWorkerバージョンID> --config wrangler.astro.production.jsonc --message "リリース障害の復旧"
```

復旧後は`/api/health`と口コミ一覧を確認する。D1の復旧判断は共通規則に従う。

## ローカルの検証コマンド

```sh
npm test
npm run build:astro
npm run build
npm run build:production
node scripts/release.mjs check-production dist/astro-production/server/wrangler.json
```

`tests/release.test.ts`は一時Gitリポジトリでタグ・main履歴・タグ先の変更と、本番／検証接続先の判定を検証する。
CIは`.dev.vars`なしで実行できる。取り込み用のパスワードは不要。
