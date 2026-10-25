# BrunoでAPIを確認する

通常確認とデータを書き換える手動更新は、別コレクションとして管理する。どちらもOpenCollection YAML形式で、VS CodeのBruno拡張とデスクトップアプリから開ける。

| 開くフォルダー | 用途 | 一括実行 |
| --- | --- | --- |
| `bruno/` | ヘルスチェック・口コミ一覧・認証なし更新の拒否 | データ更新を含まない |
| `bruno-manual/` | Basic認証付き口コミ更新 | このコレクションの実行はD1を全件置換する |

## VS Code拡張での初回設定

1. [公式Bruno拡張](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno)をインストールする。
2. 左側のBrunoアイコンから「＋」→「Open Collection」を選び、このリポジトリの `bruno/` を開く。
3. `npm run dev` で開発サーバーを起動する。
4. Brunoの右上の環境を `local` に切り替える。
5. ヘルスチェックを開き、URL欄右端の「→」で個別送信する。Responseの200とTestsの成功を確認する。
6. 口コミ一覧と認証なし更新の拒否も送信し、それぞれ200・401を確認する。

リクエストがテキスト表示になった場合はBrunoアイコンでGUI表示へ切り替える。BrunoはAPIをホストしないため、ローカル確認には開発サーバーが必要。デスクトップアプリでは「Open Collection」から同じフォルダーを開く。

通常確認には認証情報の設定は不要。フォルダーまたはコレクションのRunnerから一括実行することもできる。

## 環境の切り替え

両コレクションに `local`・`production` を用意している。

| 環境 | baseUrl | 用途 |
| --- | --- | --- |
| `local` | `http://localhost:5173` | 開発用リモートD1を使用する開発API |
| `production` | `https://pakoirileo.nokishita.app` | デプロイ済み本番API |

環境の `baseUrl` を実際の起動URLへ合わせる。ポートが異なる場合も個々のリクエストURLを書き換える必要はない。`npm run dev:worker` は `http://localhost:8787` を使う。環境ファイルは各コレクションの `environments/` にある。

## 通常確認の内容

| ファイル | API | Tests |
| --- | --- | --- |
| `bruno/checks/health.yml` | `GET /api/health` | 200、status、キャッシュ禁止 |
| `bruno/checks/reviews.yml` | `GET /api/reviews` | 200、口コミの項目・型、訪問年月、最終収集日時 |
| `bruno/checks/refresh-unauthorized.yml` | 認証なしの `POST /api/reviews/refresh` | 401、Basic認証チャレンジ |

口コミ0件・`lastUpdatedAt: null` は未収集時の正常応答。ヘルスチェックはWorkerの応答だけを確認し、D1・Browser Runの稼働までは確認しない。

## 手動更新

**現行の認証付き更新APIは、収集結果で接続先D1の口コミを全件置換する。** ローカルでも開発用リモートD1を書き換え、Browser Runの利用が発生する。

1. Brunoの「＋」→「Open Collection」で `bruno-manual/` を別コレクションとして開く。
2. `bruno-manual/.env.example` を同じフォルダーの `.env` へコピーする。
3. `.env` に対象環境の認証情報を設定する。
4. 環境を `local` にし、接続先の `baseUrl` を確認する。
5. `refresh.yml` を開き、URL欄右端の「→」で送信する。
6. 200とTestsの成功を確認し、通常確認側の口コミ一覧を再取得する。

```bash
cp bruno-manual/.env.example bruno-manual/.env
```

`BRUNO_LOCAL_USERNAME`・`BRUNO_LOCAL_PASSWORD` は、開発サーバーの `.dev.vars` にある `BASIC_AUTH_USERNAME`・`BASIC_AUTH_PASSWORD` と同じ値にする。本番更新時だけ `BRUNO_PRODUCTION_USERNAME`・`BRUNO_PRODUCTION_PASSWORD` を設定し、`production` と本番URLを確認してから送信する。

`.env` はBrunoがコレクション直下から読み込む。既存の `.gitignore` で除外されている。認証情報の実値を環境YAML・リクエスト・CLI引数・共有ログへ記載しない。両コレクションの `.env.example` は空のひな型であり、実値は含まない。

更新リクエストのタイムアウトは10分。通信切断時もサーバー側の処理が継続する可能性があるため、ログと一覧を確認してから再実行する。自動再試行はしない。

## 拡張の個別送信がスキップされていた原因

インストール済みのBruno拡張6.0.0の実装では、`req.getExecutionMode()` が参照する実行モードが設定されていなかった。そのため、従来の送信前スクリプトは個別送信もスキップしていた。

実行モードによる判定は撤去し、通常確認のコレクションへ認証付き更新を含めない構成に変更した。既存のコレクション表示が残る場合は一度閉じ、`bruno/` と `bruno-manual/` を開き直す。古い `manual/refresh.yml` は使用しない。

## CLI（任意）

確認したCLIは4.3.0。通常確認は次のコマンドで実行する。

```bash
cd bruno
npx --yes @usebruno/cli@4.3.0 run --env local
```

意図的に開発用D1を更新するときは、別コレクションへ移動して対象ファイルを指定する。

```bash
cd bruno-manual
npx --yes @usebruno/cli@4.3.0 run refresh.yml --env local
```

本番更新を明示的に実行する場合は `--env production` を指定する。以前の `runManualUpdate` フラグは不要。コマンドの `cd` はリポジトリ直下から実行する。

## API追加・変更時

- 通常確認は `bruno/checks/` に追加し、ステータスと主要な応答項目のTestsを記載する。
- データを書き換えるリクエストは `bruno-manual/` に置く。通常確認へ混在させない。
- 接続先変更は両コレクションの `environments/` へ反映する。認証情報の実値は記載しない。
- #9でCMSへの追加のみの取り込みへ移行するときは、全件置換の説明・リクエスト名・Testsも更新する。

## 検証結果（2026-10-25）

- 実開発API：ヘルスチェック・一覧は200、認証拒否は修正後401。不正な認証情報でも401とBasic認証ヘッダーを確認した。
- 認証付き更新：分離前にユーザー承認後の実開発APIで200、1 Test成功。更新後の一覧は37件。分離後の実D1更新は再実行していない。
- 拡張GUI：旧構成のコレクション読み込みと個別送信のスキップをユーザーの画面で確認。分離後のGUI操作確認は未実施。
- CLI：分離後は一時応答サーバーで通常確認4 Testsと手動更新1 Testが成功し、Basic認証付き送信を確認した。実D1の検証とは区別する。
- 依存ロックの不足エントリーを補完し、既存パッケージのバージョンを変えずに `npm ci --no-audit --no-fund` と `npm run build` が成功した。
- 本番APIの実行は未実施。

## 公式資料

- [VS Code拡張の操作](https://docs.usebruno.com/vs-code-extension/install-config)
- [OpenCollection YAML](https://docs.usebruno.com/opencollection-yaml/overview)
- [.envによる認証情報管理](https://docs.usebruno.com/secrets-management/dotenv-file)
- [CLI実行](https://docs.usebruno.com/bru-cli/run/overview)
