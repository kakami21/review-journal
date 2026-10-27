# アプリ内いいねの仕様と導入

食べログ・手入力の口コミ、ノート、記事に共通のいいねを提供する。食べログの取得値はCMSと従来の口コミAPIへ残し、カードにはこのアプリの票だけを表示する。

## 保存と投稿の識別

`post_likes` はアプリ管理のD1テーブルとし、`post_key`・`visitor_id`・`created_at` を保持する。`(post_key, visitor_id)` を主キーにする。追加はこの主キーの競合だけを無視し、取り消しは本人の票だけを削除する。別カウンターは設けず、票から件数を集計する。

`post_key` は `reviews:{CMSコンテンツID}` または `entries:{CMSコンテンツID}`。公開用Post IDや変更可能なスラッグを保存キーに使わない。CMSの編集・再取り込み・公開停止・ゴミ箱・復元で票を変更しない。完全削除して新しいCMS投稿を作れば別の投稿になる。

`PostContent` はCMS本文から変換した内容、公開APIの `Post` はそれにアプリの `likeCount` を加えた型。以前の `review.likeCount` は共通カードのモデルから外す。CMSの `like_count` や互換APIの意味は変えない。

## 閲覧者とAPI

| 操作 | エンドポイント | 結果 |
| --- | --- | --- |
| 閲覧者Cookieの発行・確認 | `POST /api/like-visitor` | 初回は発行だけ、次の往復でconfirmedになる |
| 件数と押下状態の一括取得 | `GET /api/post-likes?ids=ID1,ID2` | 最大100件。Cookieなしはliked=false |
| いいね追加 | `PUT /api/post-likes/:id` | 同じ票を再送しても重複しない |
| 本人の票の取り消し | `DELETE /api/post-likes/:id` | 未登録・再送でも他の票に影響しない |

CookieはランダムなUUIDと期限をHMAC署名し、1年間保持する。HttpOnly・SameSite=Lax・Path=/とし、Domainを指定しない。HTTPSではSecureを付ける。ローカルのHTTP確認ではSecureを付けない。署名鍵は32文字以上を使い、コードや票のテーブルへ保存しない。

Cookie発行と票の保存を別リクエストにする。全タブでWeb Locksの同じロックを使い、初回発行を直列化する。Cookieが往復できない場合やWeb Locks非対応の環境では、別の識別方法へ切り替えず操作できない旨を表示する。本文の閲覧と件数の表示は維持する。Cookie削除・期限切れや別端末は別の閲覧者になり、厳密な1人1票は保証しない。

変更APIはOriginと専用ヘッダーを検証する。閲覧者ごとの更新制限はCloudflareのRate Limitingで30回/60秒。超過は429。これは拠点ごとの近似制限であり、世界合算の厳密な上限ではない。IPアドレスは票の識別や永続保存に使わない。

対象はサーバーの公開版クエリで解決する。非公開・ゴミ箱・存在しない投稿の操作と状態取得は404。閲覧者別状態と操作応答はエラーを含めて `Cache-Control: private, no-store`。公開一覧の件数はCMS本文キャッシュとは別に読む。

## 画面

件数と自分の押下状態をまとめて取得する。操作中の再操作を抑え、成功応答の件数だけを表示へ反映する。失敗や不正な応答を成功扱いにせず、古い状態取得が操作成功後の表示を巻き戻さないようにする。別タブから戻った際は状態を再取得する。

ボタンは `aria-pressed` と「いいね」「いいねを取り消す」の名前を持つ。キーボードでも操作でき、Cookie拒否・非対応ブラウザ・通信失敗・頻度制限は画面に理由を表示する。

## 導入の順序

開発と本番を分離し、[リリース手順](releases.md)に従う。本機能の開発対象はAstro・EmDash構成。旧Vite構成は互換性のビルド検証用で、匿名いいねAPIは提供しない。

1. 対象D1をバックアップし、`astro/migrations/0002_post_likes.sql` を含む未適用分を確認する。先にアプリ用マイグレーションを適用してからコードを公開する。
2. 開発用 `table-notes-development` と本番 `dining-archive-db` を取り違えず、対応するWrangler設定を必ず指定する。
3. 環境ごとに異なるランダムな `POST_LIKE_SECRET` をWorkerのSecretへ設定する。値はCLI引数・チャット・コミットへ書かない。`wrangler secret put` は公開を伴うため、設定もリリース操作として扱う。公開前にステージする場合は公式のversions secretの手順を使う。
4. Wrangler設定の `POST_LIKE_LIMITER` を確認する。開発と本番は別のnamespace_idを使う。`npm run types:astro` でバインディング型を生成する。
5. テスト・ビルド後に通常のリリース手順で公開し、3種類と食べログの操作、別ブラウザ、再読み込み、公開停止・再公開を確認する。

```sh
# 開発用DBの確認と適用。実行前にバックアップと未適用分を確認する。
npx wrangler d1 migrations list table-notes-development --remote --config wrangler.astro.jsonc
npx wrangler d1 migrations apply table-notes-development --remote --config wrangler.astro.jsonc

# 本番DBはリリース手順に従って別途適用する。
npx wrangler d1 migrations list dining-archive-db --remote --config wrangler.astro.production.jsonc
npx wrangler d1 migrations apply dining-archive-db --remote --config wrangler.astro.production.jsonc
```

ローカルのAstro開発では無視対象の `.dev.vars` に署名鍵を設定する。CIは鍵なしでテスト・ビルドできるが、いいねAPIの実利用には設定が必要。未設定を仮の鍵や空の件数へ置き換えない。

## 独立したブラウザ確認

`node tests/likes-browser.mjs` で、固定の公開投稿と実API・メモリ内SQLiteを接続した確認サーバーを起動できる。`http://127.0.0.1:4399/posts` がPC表示、`/mobile` は390px幅のiframe表示。実CMSやリモートD1へは接続せず、終了時に票を破棄する。頻度制限は単体テストで確認し、このサーバーでは制限しない。

この確認は開発Workerの認証・バインディング・実データによる確認とは区別する。サーバー再起動で署名鍵も変わるため、再確認時は確認サイトのCookieを削除する。

## 復旧

コードを前のバージョンへ戻しても `post_likes` は削除しない。旧コードは票を参照しないため、保持したまま再公開できる。CMS本文を票のバックアップで置き換えない。署名鍵を変更すると既存Cookieの署名が無効になるので、通常の公開では同じ環境の鍵を維持する。

## 参照

- [SQLiteの対象を絞ったUPSERT](https://www.sqlite.org/lang_upsert.html)
- [Honoの署名Cookie](https://hono.dev/docs/helpers/cookie)
- [Cloudflareの頻度制限](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Web Locksのタブ間排他](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
