# 本番へ公開する手順

プロジェクトルートで実行する。`npm run deploy:production` は型チェック・本番ビルド・本番Workerへの公開を順に実行する。GitHubへのpushだけでは公開されない。

## 1. 接続するアカウントを指定する

```sh
export CLOUDFLARE_ACCOUNT_ID=981a5c317da0eac85b328bc8dbcd9f6a
```

複数のCloudflareアカウントを利用しているため、Pandalizeアカウントを明示する。未ログインの場合だけ `npx wrangler login` を実行する。

## 2. テストする

```sh
npm test
```

失敗した場合は公開せず、原因を修正する。

## 3. 本番DBの未適用SQLを確認する

```sh
npx wrangler d1 migrations list table-notes-production-db --config wrangler.astro.production.jsonc --remote
```

`No migrations to apply!` なら適用操作は不要。そのまま次へ進む。

未適用ファイルがある場合は `migrations/emdash/` の対象SQLを確認し、先にpreviewで検証する。内容と本番への適用順を確認できた場合だけ、次を実行する。

```sh
npx wrangler d1 migrations apply table-notes-production-db --config wrangler.astro.production.jsonc --remote
```

2026年11月3日の環境移行後、追加SQLとEmDash本体のマイグレーションに未適用分がないことを確認済み。手入力投稿コレクション・R2・KV・秘密値も設定済みのため、今回の再公開で初期設定を繰り返す必要はない。

EmDash本体を更新した場合の内部マイグレーションと、コレクションの追加・変更は、この追加SQL一覧とは別に確認する。seedファイルの変更だけでは、設定済みCMSへコレクション変更は反映されない。

## 4. 本番へ公開する

```sh
npm run deploy:production
```

出力のWorker名が `table-notes-production`、DB名が `table-notes-production-db`、R2名が `table-notes-production-media` であることを確認する。KVは本番用ID `d3419d12971c4d3ca72503b4d3674016` を使う。

成功時に表示される `Current Version ID` を記録する。

## 5. 公開後の画面を確認する

- ホーム：<https://pakoirileo.nokishita.app/>
- 管理画面：<https://pakoirileo.nokishita.app/_emdash/admin/>
- ヘルスチェック：<https://pakoirileo.nokishita.app/api/health>

ホームと投稿本文の表示、管理画面へのログインを確認する。previewの投稿が本番へコピーされるわけではなく、本番で公開済みの投稿だけが表示される。

失敗時はエラーと直前のVersion IDを確認し、正常だったコードを本番設定で再ビルド・公開する。コードの復旧時も現在の本番DB・KV・R2を保持する。WorkerのロールバックではDB変更は戻らない。
