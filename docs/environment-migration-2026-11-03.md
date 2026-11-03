# 2026年11月3日の環境名統一

previewとproductionへ移行し、両環境の公開画面・API・管理画面のHTTP 200を確認した。利用者のpreview用パスキー登録・ログイン完了を受け、旧staging URLと旧資産の削除まで完了した。

| 資産 | preview | production |
| --- | --- | --- |
| Worker | `table-notes-preview` | `table-notes-production` |
| D1 | `table-notes-preview-db` | `table-notes-production-db` |
| D1 ID | `b033a198-5c81-4838-a955-2a6a7fbaefaa` | `2c3e244f-ace3-4cc3-b70c-bca3f17513e4` |
| KV | `table-notes-preview-session` | `table-notes-production-session` |
| R2 | `table-notes-preview-media` | `table-notes-production-media` |
| 公開URL | `https://preview.pakoirileo.nokishita.app` | `https://pakoirileo.nokishita.app` |
| Worker Version ID | `f9e55bca-975b-458f-bea0-924901473394` | `4bad1172-3da4-4c37-a489-ccac01147ea1` |

公開タグは両環境とも `migration-20261103`。公開時点ではコミット前の作業ツリーを使用し、公開した版は上記Worker Version IDで追跡する。

## 引き継いだデータ

- preview：口コミ42件、手入力記事1件。村上春樹の記事は移行元で公開済みだったため、公開状態を維持した。
- production：口コミ38件。現在の画面で必要な手入力投稿コレクションも追加した。
- 両環境の投稿・ユーザー・パスキー・メディア情報を件数とハッシュで照合し、一致を確認した。
- KVはIDと内容を保持して名称だけを変更した。R2の移行元は空だった。
- 承認済みの移行用SQLと一時秘密値ファイルは削除した。

## 削除済みの旧資産

- Worker：`tabelog-writer`、`dining-archive`、`table-notes-astro-staging`
- D1：`table-notes-development`、`dining-archive-db`、`table-notes-staging`
- 空のR2：`table-notes-media-development`、`dining-archive-media`
- 旧カスタムドメイン：`staging.pakoirileo.nokishita.app`
- ローカルの旧生成物：`dist/astro`、`dist/tabelog_writer`、`dist/dining_archive`

別プロジェクトの資産は変更していない。

## パスキー移行

旧staging URLを新preview Workerへ一時接続した。旧URLの一般設定から「Continue on preview.pakoirileo.nokishita.app」で移動し、新URL用のパスキーを追加した。

利用者の登録・ログイン完了とDB上の新パスキーを確認後、旧stagingドメイン、旧Worker、旧D1を削除した。preview設定からも旧ドメインを取り除き、再ビルド・公開を完了した。

## 実行と確認

- `npm run dev`：サーバーはローカル、D1・KV・R2はpreviewのリモート資産。
- `npm run deploy:preview`：previewのWorkerと資産。
- `npm run deploy:production`：productionのWorkerと資産。
- テスト151件、両環境ビルド、型生成、本番設定の照合が成功した。

旧DBの手元バックアップは保管していない。コードだけを戻す場合も新DBとKVを維持し、対象環境の設定を指定して再ビルド・公開する。WorkerのロールバックではDBの内容は戻らない。
