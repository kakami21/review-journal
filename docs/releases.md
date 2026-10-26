# table-notesの本番リリース設定・手順

CI、タグ公開、公開後確認、GitHub Releases、DB変更、復旧の運用は[共通リリース規則](rules/release.md)に従う。この文書は本プロジェクトの対象とコマンドを具体化する。

## 対象と初回設定

| 項目 | 設定 |
| --- | --- |
| 本番Worker | `dining-archive` |
| 本番D1 | `dining-archive-db` |
| 公開URL | `https://pakoirileo.nokishita.app` |
| Wrangler設定 | `wrangler.jsonc` |
| GitHub Environment | `production` |
| Environment secret | `CLOUDFLARE_API_TOKEN` |
| Worker側の必須シークレット | `BASIC_AUTH_PASSWORD` |
| CIワークフロー | `.github/workflows/ci.yml` |
| 公開ワークフロー | `.github/workflows/release.yml` |
| 本番公開のconcurrencyグループ | `production-release` |

Cloudflareの本番Worker → Settings → Buildsでmain連携の停止を確認する。Environmentのタグ制限・公開用トークン・秘密値の扱いは共通規則に従って設定する。
Wranglerの必須シークレット宣言で`BASIC_AUTH_PASSWORD`の不足を検出する。Actionsからこの値を読み取る必要はない。

初回設定の確認状況と公開結果は[Issue #23](https://github.com/kakami21/table-notes/issues/23)へ記録する。
Astro検証用Workerへの公開コマンドは使わない。Astro本番化の[Issue #11](https://github.com/kakami21/table-notes/issues/11)で接続先検証と手順を更新する。

## 公開後の確認

Actionsの`Release`を開き、Summaryのタグ・コミット・Workerバージョンを確認する。
ワークフローのヘルスチェックは`/api/health`のHTTP 200と`status: ok`を検証する。口コミ一覧も確認する。

公開HTMLに埋め込んだバージョンは、開発者ツールのConsoleで確認できる。

```js
document.querySelector('meta[name="release-version"]').content
```

## D1の操作

本番D1の適用状態とバックアップを確認し、必要な変更がある場合だけ、共通規則の順序で実行する。

```sh
npx wrangler d1 migrations list dining-archive-db --remote --config wrangler.jsonc
npx wrangler d1 export dining-archive-db --remote --config wrangler.jsonc --output /安全な保存先/backup.sql
npx wrangler d1 migrations apply dining-archive-db --remote --config wrangler.jsonc
```

口コミ一覧APIには`review_list`ビューが必要。`/api/health`の成功だけでは、そのビューや一覧APIの正常性を保証しない。

## 復旧時のコマンド

Summary・ログ・CloudflareのDeploymentsで公開状態とバージョンを確認する。
コードを戻す場合は、共通規則に従い正常だったWorkerバージョンIDを指定する。

```sh
npx wrangler deployments list --config wrangler.jsonc
npx wrangler rollback <正常だったWorkerバージョンID> --config wrangler.jsonc --message "リリース障害の復旧"
```

復旧後は`/api/health`と口コミ一覧を確認する。D1の復旧判断は共通規則に従う。

## ローカルの検証コマンド

```sh
npm test
npm run build:astro
npm run build
node scripts/release.mjs check-production dist/dining_archive/wrangler.json
```

`tests/release.test.ts`は一時Gitリポジトリでタグ・main履歴・タグ先の変更と、本番／検証接続先の判定を検証する。
CIは`.dev.vars`なしで実行できる。ビルド時の必須シークレット不足の警告は、実行時パスワードをCIのビルドへ渡していないため。本番デプロイではWorker側の登録を検証する。
