# BrunoでAPIを確認する

Brunoデスクトップアプリから、リポジトリの `bruno/` をコレクションとして開く。アプリがAPIをホストするわけではないため、ローカル確認では別途開発サーバーを起動する。

公式推奨のOpenCollection YAML形式を使用する。作成したファイルはBruno CLI 4.3.0で読み込み・実行を確認した。デスクトップGUIでの操作確認は未実施。

## 初回設定

1. [公式ダウンロード](https://www.usebruno.com/downloads)からBrunoデスクトップアプリをインストールする。
2. アプリの「Open Collection」で、このリポジトリの `bruno/` フォルダーを選ぶ。
3. 環境を `local` に切り替える。
4. 認証付き更新を使う場合は、`bruno/.env.example` を `bruno/.env` にコピーし、必要な環境の認証情報だけを設定する。

```bash
cp bruno/.env.example bruno/.env
```

`BRUNO_LOCAL_USERNAME`・`BRUNO_LOCAL_PASSWORD` には、開発サーバーの `.dev.vars` にある `BASIC_AUTH_USERNAME`・`BASIC_AUTH_PASSWORD` と同じ値を設定する。本番を手動更新する場合だけ、`BRUNO_PRODUCTION_USERNAME`・`BRUNO_PRODUCTION_PASSWORD` に本番の認証情報を設定する。両環境の認証情報は別々に扱う。

`.env` はBrunoがコレクション直下から読み込む。既存の `.gitignore` でGit管理対象外になっている。実値を `environments/*.yml` やリクエストへ直接書かず、CLIの引数にも渡さない。アプリの実行履歴・共有するログにも認証情報を含めない。

## 環境の切り替え

| 環境 | baseUrl | 用途 |
| --- | --- | --- |
| `local` | `http://localhost:5173` | `npm run dev` で起動したAPI。開発用リモートD1を使用 |
| `production` | `https://pakoirileo.nokishita.app` | デプロイ済みの本番API |

URLは環境ファイルの `baseUrl` で管理する。環境を切り替えれば全リクエストへ反映されるため、個々のURLを書き換える必要はない。ポートが変わった場合は `local` の `baseUrl` を実際の起動URLへ合わせる。`npm run dev:worker` の場合は `http://localhost:8787` を使用する。

Astro移行後も、APIを提供する開発サーバーのURLへ合わせる。APIのパス・認証・応答が変更された場合は、このコレクションも同じ変更で更新する。

## 日常の確認

1. リポジトリ直下で `npm run dev` を実行する。
2. Brunoで `local` を選択し、接続先URLを確認する。
3. `checks` フォルダーをRunnerで実行する。
4. 各リクエストのTestsで結果を確認する。

| ファイル | リクエスト | 確認内容 |
| --- | --- | --- |
| `checks/health.yml` | `GET /api/health` | 200、`status: ok`、`Cache-Control: no-store` |
| `checks/reviews.yml` | `GET /api/reviews` | 200、`reviews` と各項目の型、訪問年月、`lastUpdatedAt` |
| `checks/refresh-unauthorized.yml` | 認証なしの `POST /api/reviews/refresh` | 401、Basic認証のチャレンジ |
| `manual/refresh.yml` | Basic認証付き `POST /api/reviews/refresh` | 個別実行時の200、整数の `count`、日時の `scrapedAt` |

未収集時の口コミ0件・`lastUpdatedAt: null` は正常。ヘルスチェックはWorkerの応答だけを確認し、D1・Browser Runの正常性は確認しない。通常確認は認証情報なしでも実行できる。

## 口コミの手動更新

**現行の更新APIは、収集結果で接続先D1の口コミを全件置換する。** ローカル実行でも開発用リモートD1を書き換え、Browser Runの利用が発生する。

1. 更新対象の環境と `baseUrl` を確認する。本番の場合は明示的に `production` を選び、本番URLであることを確認する。
2. 対象環境の認証情報を `bruno/.env` に設定する。
3. `manual/refresh.yml` を開き、このリクエストだけをSendで実行する。
4. 200・`count`・`scrapedAt` を確認し、口コミ一覧を再取得して結果を確認する。

フォルダー・コレクションのRunnerでは、認証付き更新を送信前スクリプトでスキップする。CLIも通常はスキップする。アプリで個別送信した場合と、CLIで明示的に更新を許可した場合だけ送信する。`runManualUpdate` を環境ファイルへ保存しない。

更新リクエストのタイムアウトは10分。タイムアウト・通信切断時はサーバー側の処理が継続している可能性があるため、Workerのログと一覧を確認してから再実行する。自動再試行は行わない。

#5のCMS移行後は、追加のみの下書き取り込みへ変わる。#9で更新APIを切り替える際、この説明・Tests・リクエスト名も更新し、現行の全件置換と混同しない。

## CLIから確認する場合

CLIは任意。アプリ用の依存関係には追加していない。確認したバージョンを指定して実行する。

```bash
cd bruno
npx --yes @usebruno/cli@4.3.0 run checks --env local
```

コレクション全体を実行しても、認証付き更新はスキップする。

```bash
npx --yes @usebruno/cli@4.3.0 run --env local
```

開発用D1を意図的に更新するときだけ、ファイルと許可フラグを指定する。認証情報は `.env` から読み込む。

```bash
npx --yes @usebruno/cli@4.3.0 run manual/refresh.yml --env local --env-var runManualUpdate=true
```

本番更新を明示的に実行する場合：

```bash
npx --yes @usebruno/cli@4.3.0 run manual/refresh.yml --env production --env-var runManualUpdate=true
```

本番の通常確認は `run checks --env production` とする。通常確認に更新許可フラグを付けない。コレクション内のスクリプトはSafe Modeで動作し、Developer Modeへの切り替えは不要。

## エラーの見方

- 401：認証情報の未設定・不一致。更新は成功していない。
- 404：接続先・APIパス・デプロイ済みのAPIを確認する。
- 500：サーバー側のエラー。収集・保存やD1のスキーマ、Workerのログを調べる。
- テスト失敗：HTTP応答と期待する契約の差異を確認する。失敗を通すために期待値を変更しない。

## API追加・変更時

- 通常確認は `checks/` に追加し、HTTPステータスと主要な応答項目をTestsへ記載する。
- データを更新するリクエストは `manual/` に置き、既存の送信前スクリプトによる一括実行防止を引き継ぐ。
- 接続先変更は `environments/` の `baseUrl` を更新する。認証情報の実値は保存しない。
- 更新の副作用・必要な設定・実行方法・検証結果をこの文書へ反映する。
- 環境別に必要な設定不足や未検証事項をIssueへ記録する。本番確認は開発環境の確認と区別する。

## 検証結果（2026-10-25）

開発APIは `CLOUDFLARE_ENV=development`、`http://127.0.0.1:5174` で起動し、CLIの `baseUrl` 上書きで確認した。#7の作業サーバーとは別ポートを使用した。

| 確認 | 結果 |
| --- | --- |
| 実開発API：ヘルスチェック | 200、Tests成功 |
| 実開発API：口コミ一覧 | 200、Tests成功 |
| 実開発API：認証なしの更新 | 期待する401ではなく500。Tests失敗 |
| 実開発API：認証付き更新 | ユーザーの明示承認後に実行。200、1 Test成功（約92秒）。更新後の一覧で37件と最終収集日時を確認 |
| 本番API | 未実行。書き込みなし |
| 一時応答サーバー：通常確認 | 200・200・401を返し、4 Tests成功。認証付き更新の送信なし |
| 一時応答サーバー：明示した個別更新 | Basic認証付きの送信と200応答、1 Test成功 |
| 一時応答サーバー：環境切り替え | production環境の接続先だけを一時サーバーへ上書きし、通常確認成功。実際の本番には未接続 |

認証なしで500になる原因は、HonoのBasic認証が投げる401の `HTTPException` を、`src/worker/index.ts` の共通 `app.onError` が500へ変換していること。コレクションでは期待する401を維持する。APIの修正は#12の対象外のため、本作業では行っていない。

一時応答サーバーによる確認はコレクションの設定とテストの確認であり、実際のBrowser Run・D1更新の成功を示すものではない。認証付き更新の実環境検証は完了した。更新後のヘルスチェックと一覧も200で、3 Testsが成功した。認証拒否が500になる問題の修正・再検証と、デスクトップGUIでの操作確認が残るため、#12は未完了とする。

環境準備時の `npm ci` は、既存ロックファイルに `@emnapi/runtime`・`@emnapi/core`・`@emnapi/wasi-threads` が不足して失敗した。`npm install --package-lock=false` で検証用依存関係を導入し、既存ロックファイルは変更していない。

## 公式資料

- [OpenCollection YAML形式](https://docs.usebruno.com/opencollection-yaml/overview)
- [コレクション直下の.envによる認証情報管理](https://docs.usebruno.com/secrets-management/dotenv-file)
- [CLIによるコレクション・個別リクエストの実行](https://docs.usebruno.com/bru-cli/run/overview)
- [VS Code拡張](https://docs.usebruno.com/vs-code-extension/overview)：エディタ内のGUIでもAPIを操作できる。今回のYAMLコレクションについて拡張での動作確認は未実施
