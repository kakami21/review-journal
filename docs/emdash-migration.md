# Astro・EmDash移行設計

[Issue #6](https://github.com/kakami21/table-notes/issues/6) の構成決定。現在の実装は `DESIGN.md`、現行スキーマは `DATABASE_DESIGN.md` を参照。この文書は移行後の設計を示し、未実装部分を含む。

## 採用する構成

- 画面・CMS：Astroのサーバー実行、Cloudflareアダプター、EmDash
- 操作部分：既存Reactを再利用
- アプリAPI：Honoを維持し、Astro側からアプリAPIのパスだけを委譲
- 収集：既存のBrowser Runとスクレイパーを再利用
- 保存：環境ごとに1つのリモートD1。取得した口コミをEmDashのコレクションへ初期登録
- 管理者：本人1人。EmDash標準のパスキー認証
- 画像：初期対象外。画像取得・アップロード・R2の導入は行わない

画面とAPIの全面的な同時書き換えを避け、口コミの編集・公開を成立させる最小の構成とする。独自記事・紹介文は初期対象に含めず、必要になった時点で追加する。

## 環境

| 用途 | リモートD1 | 選択方法 |
| --- | --- | --- |
| 本番 | `dining-archive-db` | `wrangler.jsonc` のトップレベル設定 |
| 開発 | `table-notes-development` | `env.development`、`CLOUDFLARE_ENV=development` |

`npm run dev`、`npm run dev:worker`、`npm run preview` は開発用D1を使用する。通常の `npm run build` と `npm run deploy` は本番設定を使用する。

既存の本番D1を維持し、開発用D1を追加する。取得データ用・編集データ用にDBを分割せず、CMS内の本文を正本にする。開発用D1は独立したスキーマとデータを持ち、本番データを自動コピーしない。

## CMSの管理対象

`reviews` コレクションで口コミを管理する。既存の `restaurants`・`reviews` テーブルを同じD1へ置くだけではCMSの編集対象にはならないため、EmDashのコレクションとして定義し、対応するAPIで登録する。物理テーブル名・CMS内部テーブルはEmDashに管理させる。

| 論理項目 | 用途 | 更新方法 |
| --- | --- | --- |
| `source_id` | 食べログ口コミID。必須・一意 | 取り込み時に設定。編集対象外 |
| `source_url` | 食べログ口コミ詳細URL | 取り込み時に設定。編集対象外 |
| `restaurant_name` | 店舗名 | 初期取得後はCMSで編集 |
| `restaurant_url` | 店舗URL | 初期取得後はCMSで編集 |
| `title` | 口コミタイトル | 初期取得後はCMSで編集 |
| `body` | 口コミ本文 | 初期取得後はCMSで編集 |
| `review_month` | 訪問年月、`YYYY-MM` | 初期取得後はCMSで編集 |
| `rating` | 評価、0〜5 | 初期取得後はCMSで編集 |
| `like_count` | 初回取得時のいいね数 | 初期取得後はCMSで編集 |
| `imported_at` | 初回登録日時 | システム管理 |

本文は複数行プレーンテキストの `text` 型とする。既存の改行とAPI形式を維持でき、リッチテキストへの変換を不要にする。未取得のタイトル・本文の扱いは既存の `null` 仕様を維持する。訪問年月に架空の日付を補完しない。

EmDashのコンテンツID・公開状態・リビジョンはCMSが管理する。食べログIDとコンテンツIDは別に扱い、公開APIの `id` は従来どおり食べログIDへマッピングする。

## 取り込みと編集

1. 口コミを取得し、必須項目と重複を検証する
1. 下書き・公開・ゴミ箱を含め、`source_id` で登録済みか確認する
1. 未登録の口コミだけを下書きとして追加する
1. 登録済みの口コミは、本文・評価・いいね数を含む全項目を上書きしない
1. 管理画面で編集・公開する
1. 公開画面・一覧APIは公開済みの内容だけを返す

取得原文の複製は保存しない。編集履歴はEmDashのリビジョンで扱う。食べログ側の修正・削除はCMSへ自動反映せず、CMS側で判断する。再取得は新規口コミの発見だけを目的とする。

`source_id` の一意制約で並行実行時の二重登録も防ぐ。事前の存在確認だけに依存しない。取り込みはCMSのライフサイクルを通し、CMS内部テーブルへの直接INSERTは行わない。

現在の `replaceAll` は廃止し、未登録分の追加へ置き換える。取り込み途中で失敗しても、既存エントリーを削除・変更しない。途中まで追加した下書きは残し、失敗を報告する。再実行は登録済みIDを除外して続行できる。全件成功と誤報しない。

ゴミ箱の口コミは再登録しない。完全削除した場合は次回取得で未登録となるため、再登録を避けたい口コミはゴミ箱に残す。

## 公開とAPI

`/`・`/reviews`、`GET /api/health`、`GET /api/reviews`、`POST /api/reviews/refresh` を維持する。HonoのAPI用404がEmDashの `/_emdash/*` やAstroページを捕捉しないように委譲範囲を限定する。

一覧APIはCMSの公開クエリから既存のレスポンス形式へ変換し、下書き・非公開データを返さない。`lastUpdatedAt` は成功した収集の最終日時として、本文とは別のシステムメタデータで保持する。新規追加0件でも収集成功時は更新する。

管理画面は本人のパスキーで認証し、初期セットアップを本番公開前に完了する。開発用と本番用は別々に登録する。更新APIのBasic認証は当面維持し、CMSの管理者セッションとは区別する。メール認証・外部ログイン・Cloudflare Accessは初期導入しない。

## 既存データの移行

1. 既存本番D1をバックアップする
1. 検証環境でCMSコレクションとAPIマッピングを作成する
1. 既存口コミを `source_id` 付きで初期登録し、件数・本文・訪問年月・評価を照合する
1. 既存サイトに公開済みの口コミは、一度限りの移行処理で照合後に公開する。以後の新規取得は下書きとする
1. 一覧APIの読み取り先をCMSへ切り替える
1. 旧テーブル・ビューは検証と復旧期間を終えてから別のマイグレーションで撤去する

移行中も同じ取得データを両方へ書き続けない。現在のSQLマイグレーションとEmDashのコアマイグレーションを区別し、適用済みSQLは変更しない。

## 後続Issue

| Issue | 実装範囲 |
| --- | --- |
| #7 | Astro基盤と検証環境。D1の本番・開発分離を引き継ぐ |
| #8 | 既存画面・API・認証の移行。CMS導入前は既存リポジトリを使用 |
| #9 | `reviews` コレクション、追加のみの取り込み、パスキー、編集・公開、一覧APIのCMSへの切り替え |
| #10 | CMSの定期処理と口コミ収集の実行条件を分離 |
| #11 | 既存データ移行、公開状態・データ保全・復旧の検証、本番切り替え |

#2の全件置換に関する検証は追加のみの取り込みへ読み替える。必須項目欠落や不完全な取得を正常扱いしない方針は維持する。#3・#4の依存分離とAPIテストは移行後の責務に合わせて適用する。

## 公式仕様との対応

- [Cloudflare構成](https://docs.emdashcms.com/deployment/cloudflare/)：Astroのサーバー実行、D1、Workerの定期処理
- [フィールド型](https://docs.emdashcms.com/reference/field-types/)：`text`、`unique`、数値・文字列の検証
- [コンテンツ編集・公開](https://docs.emdashcms.com/guides/working-with-content/)：下書きと公開版、リビジョン
- [認証](https://docs.emdashcms.com/guides/authentication/)：標準パスキー、ドメインごとの認証
- [REST API](https://docs.emdashcms.com/reference/rest-api/)：登録・公開のライフサイクルと生成OpenAPI
- [ViteのCloudflare環境](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)：開発・ビルド時の環境選択

このIssueでは設計とD1の環境分離を確認する。EmDashのフィールド設定・書き込みAPI・パスキー・ルーティングの実動作は #7〜#11 で検証する。R2は初期対象外とし、採用するEmDashのバージョンでストレージ未設定時の動作を #9 で確認する。

## #6 の検証結果（2026-10-25）

- `npm run types` で環境別の型を再生成し、`npm run build` と `CLOUDFLARE_ENV=development npm run build` の型チェック・ビルドが成功した。
- 本番ビルドの生成設定は `dining-archive-db` と既存の本番ドメイン、開発ビルドは `table-notes-development` と空の `routes` を持つことを確認した。D1のIDも異なる。
- 両ビルドで `wrangler deploy --dry-run` が成功し、表示されるD1バインディングが各環境と一致した。実際のデプロイやリモートD1への書き込みは行っていない。
- リモートD1の実在・スキーマ・API応答はこの確認では保証しない。開発環境の実動作は #7、EmDashの導入・公開は #9、既存データの照合は #11 で検証する。
