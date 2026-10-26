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

## 本番切り替え前に実装・検証すること

- #4の完了後、Astroの本番ビルド先を作り、Worker `dining-archive`・本番D1・既存ドメインだけを参照することを生成設定で検証する。
- 本番CMSのSESSION KVとBasic認証シークレットを確認する。検証用のSESSION KVや管理者データを流用しない。
- 管理者の初回セットアップと本番ドメインでのパスキー登録を手順に組み込む。検証ドメインのパスキーで本番へログインできると仮定しない。認証情報をSQLの手編集で移植しない。
- DB準備・管理者登録・初期データ公開の順序と、その間の既存サイトへの影響をリハーサルで確定する。無停止で切り替えられることは未検証。
- Releaseの最後のビルド・公開コマンドと `check-production` をAstro用へ揃える。現在のViteビルドがAstro生成物を削除する順序をそのまま使わない。
- HTMLの `release-version` をAstro側へ引き継ぐ。CIはmainへのマージで検証だけを実行し、正式タグのpushだけで公開する。
- CMS保守Cronだけを接続し、口コミ定期収集を有効にしない。

## 切り替え当日の確認と復旧

1. 口コミ更新を止め、最終バックアップと復元・照合を終える。
2. レビュー済みの移行手順でCMSを初期化し、既存口コミの登録・公開と件数・内容・日時を照合する。
3. 成功したmainのコミットへ新しい正式タグを付けて公開する。新しいバージョン番号は公開時に決定する。
4. 既存ドメインでホーム、一覧、API、編集・公開、未認証更新の拒否、下書き非公開、タグ表示を確認する。
5. 公開後の新規編集・収集を始める前に、旧Workerへ戻せるかを判断する。WorkerのロールバックだけではCMSの編集内容は旧テーブルへ戻らない。移行後の書き込みを無視して古いSQLを上書き復元しない。

未実施：CMSへの本番データ初期移行、Astro本番設定・Releaseの変更、本番管理者登録、本番切り替え・切り替え後の復旧試験。

参考：[D1のインポート・エクスポート](https://developers.cloudflare.com/d1/best-practices/import-export-data/)、[EmDash認証](https://docs.emdashcms.com/guides/authentication/)、[EmDashのCloudflare構成](https://docs.emdashcms.com/deployment/cloudflare/)。
