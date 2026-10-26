# タグによる本番リリース

運用全体の共通規則は[共通リリース規則](../.github/instructions/release.instructions.md)を正本とする。
以下はtable-notesの公開先・設定・コマンドを具体化した手順。

## 実行の流れ

- 作業PRとmainへのpush：`CI` がテスト・Astroビルド・本番用ビルドを実行する。本番公開の処理は含まない。
- `vMAJOR.MINOR.PATCH` タグの新規push：`Release` がタグ形式・対象コミット・main履歴を確認し、テストとビルド成功後に本番へ公開する。
- 対象は現在の本番Worker `dining-archive`、本番D1 `dining-archive-db`、`https://pakoirileo.nokishita.app`。本番設定は `wrangler.astro.production.jsonc`。検証用Workerへの公開コマンドは使わない。
- タグ更新・削除・強制pushでは公開しない。公開済みタグは付け替えず、修正は新しいバージョンを使う。

## 初回設定（公開前に必要）

1. Cloudflareで本番公開用APIトークンを作る。公式の「Edit Cloudflare Workers」テンプレートを基に、このプロジェクトのアカウント・ゾーンと実際に必要な権限へ限定する。個人のWrangler OAuthトークンをCIへ流用しない。
2. GitHubのSettings → Environments → `production` → Environment secretsに、`CLOUDFLARE_API_TOKEN` を登録する。値はチャット・コード・CLI引数へ貼り付けない。
3. `production` のDeployment branches and tagsは、タグの `v*` だけを許可する。承認者は設定せず、タグ作成を公開操作として扱う。
4. Cloudflareの本番Worker → Settings → BuildsでGit連携を確認する。mainへのpushで公開する設定があれば停止し、このActionsだけを本番公開の経路とする。確認せずに初回タグをpushしない。
5. 本番Workerに既存の `BASIC_AUTH_PASSWORD` シークレットが登録されていることを確認する。Actionsが値を読み取る必要はない。Wranglerの必須シークレット宣言で、未設定のままのデプロイを拒否する。

設定の確認状況と初回の本番公開結果はIssue #23へ記録する。ローカルの認証が通るだけでは、GitHub上の公開が検証できたとは扱わない。

## タグの作成

タグはリポジトリへの書き込み権限を持つ担当者が、mainのCI成功を確認して作成する。MAJORは互換性のない変更、MINORは互換性のある機能追加、PATCHは互換性のある修正に使う。プレリリースやゼロ埋めは本番用には受け付けない。

例として `v1.0.0` を公開する場合：

```sh
git fetch origin
git log -1 origin/main
git tag -a v1.0.0 origin/main -m "Release v1.0.0"
git push origin refs/tags/v1.0.0
```

タグを複数まとめてpushせず、前回のRelease完了を待つ。`production-release` グループで公開を同時実行しない設定だが、待機中の実行順を保証するものではない。

Actionsの `Release` を開き、成功とSummaryのタグ・コミット・Workerバージョンを確認する。公開後の `/api/health` が200かつ `status: ok` であることもワークフローが検証する。

公開ページのHTMLには `<meta name="release-version" content="v1.0.0">` のように実際のタグ名を埋め込む。開発者ツールのConsoleで `document.querySelector('meta[name="release-version"]').content` を実行すると確認できる。タグ以外のビルドは `unreleased` と表示する。

同じタグの実行を再実行すると同じコミットを再公開する。通信失敗時も公開済みの可能性があるため、Summary・ログ・CloudflareのDeploymentsを確認してから判断する。自動再試行・自動ロールバックはしない。

## GitHub Releases

公開成功後、既存タグを選んでGitHub Releaseを作成する。概要、含まれるPR、利用者に影響する変更、必要な手動操作、Actions実行URLとWorkerバージョンを記載する。Releaseの公開自体はデプロイを起動しない。

```sh
gh release create v1.0.0 --verify-tag --title v1.0.0 --generate-notes
```

このコマンドは既存タグを使う。Actionsからタグを作る仕組みは設けず、GitHub標準トークンで作成したイベントが別のワークフローを起動しない問題も避ける。

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

## D1の扱い

リリースワークフローはD1マイグレーションを自動実行しない。アプリ公開とDB変更を同一の処理で巻き戻せないため、変更内容をレビューし、必要なときだけ先にバックアップ・互換性のあるスキーマ変更を行う。

```sh
npx wrangler d1 migrations list dining-archive-db --remote --config wrangler.astro.production.jsonc
npx wrangler d1 export dining-archive-db --remote --config wrangler.astro.production.jsonc --output /安全な保存先/backup.sql
npx wrangler d1 migrations apply dining-archive-db --remote --config wrangler.astro.production.jsonc
```

適用前に対象が本番D1であることを確認する。未適用マイグレーションが必要なリリースでは、適用・照合が完了するまでタグをpushしない。復旧用の旧構成の一覧APIには `review_list` ビューが必要で、`/api/health` の成功だけではDBスキーマや口コミ一覧の正常性を保証しない。

## 失敗時の復旧

- 公開前の検証失敗：本番は更新されない。原因を修正してmainへ取り込み、新しいタグを作る。
- 公開後のヘルスチェック失敗：公開済みの可能性がある。ログのバージョンとCloudflare Deploymentsを確認する。
- コードを戻す場合：直前の正常なWorkerバージョンを明示して以下を実行し、ヘルスチェックと一覧を確認する。タグは付け替えない。

```sh
npx wrangler deployments list --config wrangler.astro.production.jsonc
npx wrangler rollback <正常だったWorkerバージョンID> --config wrangler.astro.production.jsonc --message "リリース障害の復旧"
```

WorkerのロールバックはD1のデータやスキーマを戻さない。DB変更がある場合は、旧コードとの互換性とバックアップからの復旧を別途判断する。

## 検証

```sh
npm test
npm run build:astro
npm run build
npm run build:production
node scripts/release.mjs check-production dist/astro-production/server/wrangler.json
```

`tests/release.test.ts` は一時Gitリポジトリでタグ・main履歴・タグ先の変更と、本番／検証接続先の判定を検証する。CIは `.dev.vars` なしで実行できる。ビルド時の必須シークレット不足の警告は、実行時パスワードをCIのビルドへ渡していないため。本番デプロイではWorker側の登録が検証される。

参考：[CloudflareとGitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)、[Wranglerの必須シークレット](https://developers.cloudflare.com/workers/configuration/secrets/)、[GitHubのイベント起動](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。
