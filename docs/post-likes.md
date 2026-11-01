# 公開投稿のアプリ内いいね

食べログの取得値`likeCount`と、アプリの票を別に扱う。公開カードは「食べログのいいね」と「アプリのいいね」を表示する。手入力の口コミ・ノート・記事にも投票できる。

## 保存と匿名識別

`post_likes`はCMSコレクション名と不変の`contentId`を保存キーにし、閲覧者IDとの複合主キーで1票に制限する。追加はPUT、取り消しはDELETEで、再送しても反転しない。件数のコピーを別カウンターへ保存せず、票を集計する。編集・取り込み・非公開化・再公開は票を変更しない。

閲覧者IDはランダムなUUIDで、Honoの署名付きHttpOnly Cookieに1年間保存する。HTTPSではSecure、SameSite=Lax、Path=/を付け、Domainは指定しない。初回操作時にCookieを発行し、次のリクエストで戻ったことを確認してから投票する。保存できない場合は案内を出し、票を送らない。無効なCookieは匿名の件数だけを返し、更新には再発行と確認を要求する。

Cookie削除・期限切れ・署名鍵の変更・別端末は別の閲覧者となる。厳密な1人1票は保証しない。署名鍵を継続して保管する。

## 公開判定とAPI

| API | 動作 |
| --- | --- |
| POST `/api/like-visitor` | Cookie発行または往復確認。投票しない |
| GET `/api/post-likes?ids=...` | 最大100件の公開件数と本人の押下状態 |
| PUT `/api/post-likes/:id` | 本人の票を1件追加 |
| DELETE `/api/post-likes/:id` | 本人の票だけを取り消し |

IDは毎回CMSの公開版クエリで解決する。下書き・非公開・ゴミ箱・存在しない投稿は404で、操作と公開集計を行わない。取得途中のCMS障害も成功扱いにしない。集計には他人の閲覧者IDを含めず、本人の状態は署名Cookieだけから決める。応答は`private, no-store`で共有キャッシュに残さない。

発行・更新には同じOriginと専用ヘッダーを要求する。更新頻度は閲覧者ごとに30回/60秒で制限し、超過時は429とRetry-Afterを返す。WorkersのRate Limitingは拠点単位の近似制限で、厳密な全世界合算ではない。

## 画面の整合

公開本文とアプリ内件数は初回HTMLに含める。Cookieなしでも閲覧と件数表示ができる。React起動後に本人の状態を読み、取得・保存中は操作を抑止する。投票を先に成功表示せず、サーバーの応答後に表示する。失敗と頻度制限は案内を残す。

Web Locksで初回Cookie発行と同じ投稿への更新をタブ間で直列化する。BroadcastChannelとフォーカス時の再取得で別タブの変更を反映する。更新前に開始した取得結果は破棄し、保存後に再取得する。これらの機能に対応するブラウザで投票を提供する。ボタンには投稿名、押下状態、取り消しの名前を付け、キーボードで操作できる。

## 導入手順

外部環境への以下の変更は、この実装作業では実施していない。

1. D1のバックアップを取得する。
2. 検証用D1 `table-notes-staging`へ`migrations/emdash/0002_post_likes.sql`を適用する。既存テーブルや適用済みマイグレーションは削除しない。
3. 32文字以上のランダムな`POST_LIKE_SECRET`を安全な入力経路で設定する。ローカルはGit管理外の`.dev.vars`、公開WorkerはWranglerのversion secret操作で準備する。値をソースやログへ記録しない。
4. 検証用の`POST_LIKE_LIMITER`設定（namespace 47001）と秘密値を含むバージョンを公開し、一連の確認を行う。
5. 確認後に本番D1 `dining-archive-db`へ同じSQLを適用する。本番は別の署名鍵とRate Limit namespace 47002を使う。
6. 本番用ビルドから公開する。秘密値・DBの準備前に公開しない。

復旧時は以前のWorkerへ戻し、新しい票のテーブルと秘密値を保持する。テーブルの削除や過去のCMSデータへの巻き戻しは不要。

## 検証

`npm test`では実SQLiteで一意制約・追加・取り消し・再送・別閲覧者・件数集計を確認し、APIとクライアントのテストでCookie拒否・改ざん・期限切れ・公開判定・500・429を確認する。

`node tests/likes-browser.mjs`は外部接続のない確認画面を`http://127.0.0.1:4399/posts`に起動する。票は一時SQLiteへ保存し、終了時に破棄する。`/mobile`で390px幅を確認できる。ローカルのChromeで追加・取り消し・再読み込み・別タブ反映・Enter操作・390px幅を確認済み。実際の検証環境のCMS・D1・Rate Limitingを通す操作は未実施。

## 参考資料

- [Hono Cookie Helper](https://hono.dev/docs/helpers/cookie)：署名付きCookie。
- [Cloudflare D1のSQL](https://developers.cloudflare.com/d1/sql-api/sql-statements/)：SQLite互換の保存処理。
- [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)：バインディングと制限の範囲。
