# BrunoでAPIを確認する

コレクションは `bruno/` の1つ。通常確認は `checks` フォルダーだけを一括実行し、データを書き換える更新は `manual/refresh.yml` を個別送信する。

## VS Code拡張で使う

1. [公式Bruno拡張](https://marketplace.visualstudio.com/items?itemName=bruno-api-client.bruno)をインストールする。
2. 左側のBrunoアイコンで「＋」→「Open Collection」を選び、リポジトリの `bruno/` を開く。
3. ターミナルで `npm run dev` を実行する。
4. Brunoの右上で `local` を選び、環境の `baseUrl` を開発サーバーのURLへ合わせる。
5. ヘルスチェックを開き、URL欄右端の「→」で送信して200を確認する。
6. 通常の一括確認は「通常確認（参照・認証拒否）」フォルダーを選んで実行する。

リクエストがテキスト表示の場合はBrunoアイコンでGUI表示へ切り替える。デスクトップアプリでも「Open Collection」から同じフォルダーを開ける。

**コレクション全体の一括実行は、認証付き更新も送信する。通常確認では `checks` だけを実行する。** 実行をスキップするスクリプトは設けない。

## 環境

| 環境 | baseUrl | 用途 |
| --- | --- | --- |
| `local` | `http://localhost:5173` | 開発用リモートD1を使う開発API |
| `production` | `https://pakoirileo.nokishita.app` | 本番API |

設定は `bruno/environments/` で管理する。ポートが変わった場合も環境の `baseUrl` だけを変更する。`npm run dev:worker` は `http://localhost:8787` を使う。Astro移行時も実際のAPI接続先へ合わせる。

## 確認するリクエスト

| ファイル | 確認内容 |
| --- | --- |
| `checks/health.yml` | 200、status、キャッシュ禁止 |
| `checks/reviews.yml` | 200、口コミの項目・型、訪問年月、最終収集日時 |
| `checks/refresh-unauthorized.yml` | 認証なし更新の401とBasic認証チャレンジ |
| `manual/refresh.yml` | 認証付き更新の200、取得件数、成功日時 |

通常確認に認証情報は不要。口コミ0件・`lastUpdatedAt: null` は未収集時の正常応答。ヘルスチェックはWorkerの応答だけを確認し、D1・Browser Runの正常性までは確認しない。

## 認証付き更新

**現行更新は収集結果で接続先D1の口コミを全件置換する。** ローカルでも開発用リモートD1を書き換え、Browser Runの利用が発生する。

1. `bruno/.env.example` を同じフォルダーの `.env` へコピーする。
2. プロジェクト直下の `.dev.vars` の `BASIC_AUTH_USERNAME` の値を `.env` の `BRUNO_LOCAL_USERNAME` へ、`BASIC_AUTH_PASSWORD` の値を `BRUNO_LOCAL_PASSWORD` へ転記する。
3. 環境を `local` にし、接続先URLを確認する。
4. `manual/refresh.yml` を開き、URL欄右端の「→」で個別送信する。
5. 200とTestsの成功を確認し、口コミ一覧を再取得する。

```bash
cp bruno/.env.example bruno/.env
```

本番更新時だけ `BRUNO_PRODUCTION_USERNAME`・`BRUNO_PRODUCTION_PASSWORD` に本番の値を設定し、`production` と本番URLを確認してから個別送信する。

`.env` はBrunoがコレクション直下から読み込み、既存の `.gitignore` でGit管理対象外になっている。認証情報の実値を環境YAML・リクエスト・CLI引数・共有ログへ記載しない。

タイムアウトは10分。通信切断時もサーバーで処理が続いている可能性があるため、ログと一覧を確認してから再実行する。自動再試行はしない。

## CLI（任意）

リポジトリ直下から実行する。確認したCLIは4.3.0。

```bash
cd bruno
npx --yes @usebruno/cli@4.3.0 run checks --env local
```

意図的に開発用D1を更新するときだけ、同じ `bruno/` から対象ファイルを指定する。

```bash
npx --yes @usebruno/cli@4.3.0 run manual/refresh.yml --env local
```

本番更新を明示的に実行する場合は `--env production` に変更する。以前の `runManualUpdate` フラグは不要。

## API追加・変更時

- 通常確認は `checks/`、データ更新は `manual/` に追加する。主要なステータスと応答項目のTestsを記載する。
- 接続先変更は `environments/` へ反映し、通常確認は引き続き `checks` だけで実行できる構成にする。
- #9でCMSへの追加のみの取り込みへ移行するときは、全件置換の説明・リクエスト名・Testsも更新する。

## 検証結果（2026-10-25）

- 実開発API：ヘルスチェック・一覧は200、認証拒否は修正後401。不正な認証情報でも401とBasic認証ヘッダーを確認。
- 認証付き更新：ユーザー承認後の実開発APIで200、1 Test成功。更新後の一覧は37件。今回のフォルダー統合後は実D1更新を再実行していない。
- 拡張6.0.0は実行モードを設定しないため、旧スクリプトが個別送信も止めていた。スクリプトを撤去し、通常確認の実行範囲をchecksフォルダーに限定する運用へ変更した。
- 統合後のCLIは一時応答サーバーでchecksの4 Tests、個別更新の1 Testが成功。実D1の検証とは区別する。GUIでの統合後の送信は未確認。
- 依存ロックの不足を補完し、既存パッケージのバージョンを変えずに `npm ci --no-audit --no-fund` と `npm run build` が成功。
- 本番APIの実行は未実施。

## 公式資料

- [VS Code拡張の操作](https://docs.usebruno.com/vs-code-extension/install-config)
- [.envによる認証情報管理](https://docs.usebruno.com/secrets-management/dotenv-file)
- [CLIのフォルダー・個別リクエスト実行](https://docs.usebruno.com/bru-cli/run/overview)
