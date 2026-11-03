# 手入力投稿・写真・いいねの導入

公開前に、検証環境、本番環境の順で実施する。設定済み環境では未実施の項目だけを行う。

| 環境 | Wrangler設定 | D1 | 非公開R2 |
| --- | --- | --- | --- |
| 検証 | `wrangler.astro.preview.jsonc` | `table-notes-preview-db` | `table-notes-preview-media` |
| 本番 | `wrangler.astro.production.jsonc` | `table-notes-production-db` | `table-notes-production-media` |

1. D1とR2の既存データをバックアップする。D1のバックアップには画像本体を含まない。
2. 表のR2バケットを作成し、公開ドメイン・`r2.dev`は有効にしない。画像はEmDash標準ルートで配信する。
3. 対象環境の管理トークン（`schema:read`・`schema:manage`）を `EMDASH_API_TOKEN` に設定し、次を実行する。

   ```sh
   node scripts/setup-entries.mjs https://対象環境のオリジン
   ```

   手入力用の `entries` と写真欄を追加する。既存投稿は変更せず、再実行できる。定義が異なる場合は停止する。設定済みサイトにはseedの更新だけでは反映されない。

4. 対象環境の設定を指定し、D1の追加SQLを適用する。

   ```sh
   npx wrangler d1 migrations apply <D1名> --config <Wrangler設定> --remote
   ```

   `0002_post_likes.sql` がいいねの保存先を追加する。適用済みSQLや既存テーブルは削除しない。

5. 環境ごとに異なる32文字以上のランダムな `POST_LIKE_SECRET` を設定する。公開WorkerはWranglerのversion secret操作で準備し、ローカルはGit管理外の `.dev.vars` に設定する。値は履歴・ソース・ログに残さず、継続して保管する。頻度制限はWrangler設定済み（検証47001、本番47002）。
6. DB・R2・秘密値の準備後に、[READMEの公開手順](../README.md#ビルドして公開する)に従って公開する。

## 公開後の確認

- 手入力の口コミ・ノート・記事、写真の追加・差し替え・取り外しを確認する。下書きの本文や写真は再公開まで公開画面に反映されないことを確認する。
- 未ログインで画像と件数が表示され、いいねの追加・取り消し・再読み込み・別タブの表示が一致することを確認する。Cookie拒否時は閲覧でき、投票は失敗として案内されることを確認する。
- 既存口コミのリンクと取り込み、スマートフォン表示を確認してから本番へ進む。画像URL自体は投稿の公開状態に関係なくアクセスできるため、機密画像を保存しない。

復旧時は以前のWorkerへ戻し、追加した `entries`・写真欄・いいねテーブル・R2・秘密値を保持する。設定・公開・実環境の確認状況は、対応するPRで確認する。
