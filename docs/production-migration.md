# Astro・EmDash本番移行（#11）

#4と並行できる準備と、本番切り替えを分ける。この手順の追加だけでは本番のコード・DBを変更しない。公開は[リリース手順](releases.md)、移行後のモデルは[移行設計](emdash-migration.md)に従う。

## 作業順と現在の状態

| 順 | 作業 | 前提・状態 |
| --- | --- | --- |
| 1 | 本番のバックアップ取得と隔離環境への復元・照合 | 2026-10-26に検証済み |
| 2 | 本番データをCMSへ初期登録・公開する処理のリハーサル | 本番バックアップを使う。検証用DBを丸ごとコピーしない |
| 3 | 本番向けAstroビルド、接続先検証、Release、タグ表示を切り替える変更 | #4を取り込み、API入口の最終構成を使う |
| 4 | 更新停止・最終バックアップ・本番移行・タグ公開 | リハーサルと変更のレビューを完了してから実施 |
| 5 | 本番で主要機能・認証・データを照合 | 成功後に#11、続いて親#5を完了する |

## バックアップと復元の確認

対象はPandalizeアカウントの `dining-archive-db`（`16a07a44-0646-4227-941d-93b3c2f6d1f8`）。検証用D1 `table-notes-development` と取り違えない。

```sh
umask 077
migration_backup_dir=$(mktemp -d /private/tmp/table-notes-migration.XXXXXX)
npx wrangler d1 export dining-archive-db --remote --config wrangler.jsonc --output "$migration_backup_dir/production.sql" > "$migration_backup_dir/export.log" 2>&1
npx wrangler d1 execute dining-archive-db --local --persist-to "$migration_backup_dir/d1-restore" --config wrangler.jsonc --file "$migration_backup_dir/production.sql"
npx wrangler d1 execute dining-archive-db --local --persist-to "$migration_backup_dir/d1-restore" --config wrangler.jsonc --command 'SELECT COUNT(*) AS reviews, COUNT(DISTINCT id) AS unique_ids FROM review_list; PRAGMA foreign_key_check;'
```

復元コマンドは必ず `--local` と独立した `--persist-to` を指定する。既存の開発DBを復元先にしない。エクスポートログには期限付きダウンロードURLが含まれるため、SQL・ログをGitへ登録しない。エクスポート中はDB要求が一時的に待たされるため、正式移行時は更新停止後に取得する。

照合対象は件数だけでなく、食べログID・店舗名・店舗URL・口コミURL・タイトル・本文・訪問年月・評価・いいね数・最終取得日時。移行前の本番APIとバックアップ復元先の両方で一致を確認する。移行後はCMSの公開済みデータと同じ項目を再照合する。

### 2026-10-26の検証結果

- SQLエクスポートを独立したSQLiteとWranglerのローカルD1へ復元できた。
- 口コミ37件・店舗37件。食べログIDの重複なし、外部キー違反なし。SQLiteの `PRAGMA quick_check` は `ok`。
- 復元データの公開API相当の全項目と最終取得日時が、本番APIと一致した。
- SQLのSHA-256：`d09aa4ec90d6303f47b404f81846ac5a87108f801a88bd18c5e948710a3989c2`。
- この時点の検証用CMSは38件あり、本番とは内容・公開状態が異なる。検証用DBを本番に上書きしない。
- 一時保管先：`/private/tmp/table-notes-11-verification/`。これは復元試験の資料であり、正式切り替え時のバックアップではない。切り替え直前に再取得し、運用用の安全な保管先へ保存する。

## データ移行で維持すること

- 既存本番DBを正本として口コミをCMS API経由で登録する。CMS内部テーブルへ直接INSERTしない。
- 一度限りの初期移行では既存の公開済み口コミを照合して公開し、以後の新規収集は下書き追加とする。通常の更新APIを呼ぶだけでは既存口コミは公開されない。
- `source_id` を維持し、登録済み・手動編集済みの内容を上書きしない。部分失敗を成功と報告せず、再実行時に重複登録・編集内容の消失がないことを検証する。
- 最終取得日時には移行実行時刻を補わず、元の成功収集日時を引き継ぐ。
- 旧 `restaurants`・`reviews`・`review_list` は復旧期間を終えるまで保持する。CMSと旧テーブルへの二重書き込みは行わない。

## Astro本番切り替え手順

本PRは切り替え準備まで。本番デプロイ・本番CMSデータの作成は未実施。初回は保守時間を設け、公開からデータ移行完了まで一覧が空になる可能性を許容する。無停止移行とは扱わない。

1. 口コミの収集・編集を停止し、上記の最終バックアップ・復元照合を行う。旧Workerの正常なバージョンIDを記録する。
2. 保護された保存先で公開APIの移行元を取得する。

```sh
node scripts/migrate-reviews.mjs snapshot /安全な保存先/source.json
```

3. [リリース手順](releases.md)に従って本番CMSコアスキーマを確認・手動適用する。アプリ所有の日時テーブルも準備する。

```sh
npx wrangler d1 migrations list dining-archive-db --remote --config wrangler.astro.production.jsonc
npx wrangler d1 migrations apply dining-archive-db --remote --config wrangler.astro.production.jsonc
```

4. 本番専用SESSION KV、管理者のパスキー認証、GitHubトークンのD1読み取り権限を確認し、CI成功済みmainへ新しい正式タグを付けて公開する。旧テーブルは削除しない。
5. 本番ドメインの `/_emdash/admin` で所有者を登録し、パスキーを登録する。検証環境の認証を流用しない。本番では開発専用セットアップAPIを使わない。所有者の管理画面で口コミの読み取り・作成・公開に必要な権限のAPIトークンを作成し、`EMDASH_API_TOKEN` 環境変数へ安全に設定する。トークンを引数・Git・チャットに残さない。
6. 本番へ初期移行し、日時を適用して完全照合する。

```sh
node scripts/migrate-reviews.mjs import /安全な保存先/source.json https://pakoirileo.nokishita.app /安全な保存先/metadata.sql
npx wrangler d1 execute dining-archive-db --remote --config wrangler.astro.production.jsonc --file /安全な保存先/metadata.sql
node scripts/migrate-reviews.mjs verify /安全な保存先/source.json https://pakoirileo.nokishita.app
```

スクリプトはCMS REST APIで下書きを作成し、取得元の全項目が一致するものだけを公開する。編集済み・ゴミ箱・重複IDとの競合は停止する。途中失敗後は同一データに限って再実行できる。日時SQLは公開内容の一致後に生成し、アプリ所有テーブルだけを書き換える。保守中は他の編集者による同時変更を禁止する。移行後はトークンを失効し環境変数を解除する。

7. 既存ドメインのホーム・一覧・API・管理画面で編集と公開・下書き非公開・未認証更新の拒否・HTMLのタグ表示を確認する。収集の定期実行は有効にしない。必要な確認後に #11 を完了する。

## ローカルリハーサル結果（2026-10-26）

- 現行本番の37件を読み取り、独立したローカルD1上の実CMSへ登録・公開した。本番DBへの書き込みは行っていない。
- 全公開項目・ID・件数・最終取得日時の一致を確認。再実行は追加0件・公開0件。
- 空の本文がCMSでは省略されるため、公開APIの空欄を `null` に揃えて互換性を維持した。
- 実CMSの下書き追加・公開・編集・公開版保護・再取得保護・取得元変更拒否・ゴミ箱再追加防止を確認。
- 本番向けビルド・接続先検証・Wrangler dry-runは成功。本番の管理者登録、トークン権限、スキーマ適用、タグ公開、公開後照合は未実施。

## 復旧

公開失敗時は記録した旧Workerバージョンへ明示的に戻し、一覧を照合する。旧テーブルを保持していても、CMSへの新規編集は旧テーブルへ同期されない。移行後の書き込みを無視した古いSQLの復元は禁止する。WorkerのロールバックとDB復旧は別々に判断する。

参考：[D1のインポート・エクスポート](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[EmDash認証](https://docs.emdashcms.com/guides/authentication/)、[EmDashコア移行](https://docs.emdashcms.com/deployment/core-migrations/)。
