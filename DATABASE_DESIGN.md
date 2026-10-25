# データベース設計書

## 1. 文書情報

| 項目 | 内容 |
| --- | --- |
| 対象システム | Tabelog Writer |
| データベース | Cloudflare D1 |
| SQL互換性 | SQLite |
| 正本 | `migrations/`配下のSQL |

## 2. 現在使用するテーブルとビュー

| オブジェクト | 種別 | 役割 | 主キー |
| --- | --- | --- | --- |
| `restaurants` | テーブル | 店舗名と店舗URLを保存する | `url` |
| `reviews` | テーブル | 食べログから取得した口コミを保存する | `id` |
| `review_list` | ビュー | 口コミ一覧API向けの読み取り形式を提供する | なし |

### 2.1 `restaurants`

| カラム | 型 | NULL | 制約 | 内容 |
| --- | --- | --- | --- | --- |
| `url` | TEXT | 不可 | PRIMARY KEY | 店舗ページURL |
| `name` | TEXT | 不可 | なし | 店舗名 |

### 2.2 `reviews`

| カラム | 型 | NULL | 制約 | 内容 |
| --- | --- | --- | --- | --- |
| `id` | TEXT | 不可 | PRIMARY KEY | 口コミ詳細URL由来のID |
| `restaurant_url` | TEXT | 不可 | FOREIGN KEY | `restaurants.url`を参照する店舗ページURL |
| `detail_url` | TEXT | 不可 | UNIQUE | 口コミ詳細URL |
| `title` | TEXT | 可 | なし | 口コミタイトル |
| `body` | TEXT | 可 | なし | 口コミ本文 |
| `review_date` | TEXT | 不可 | `YYYY-MM` | 訪問年月 |
| `rating` | REAL | 不可 | 0以上5以下 | 評価値 |
| `like_count` | INTEGER | 不可 | 0以上 | いいね数 |
| `scraped_at` | TEXT | 不可 | なし | 取得日時 |

### 2.3 `review_list`

`reviews`と`restaurants`を結合し、口コミ一覧APIが必要とする項目を提供する。データは保持せず、一覧取得と最終取得日時の算出に使用する。書き込みは行わない。

| カラム | 参照元 |
| --- | --- |
| `id` | `reviews.id` |
| `restaurant_name` | `restaurants.name` |
| `restaurant_url` | `restaurants.url` |
| `detail_url` | `reviews.detail_url` |
| `title` | `reviews.title` |
| `body` | `reviews.body` |
| `review_date` | `reviews.review_date` |
| `rating` | `reviews.rating` |
| `like_count` | `reviews.like_count` |
| `scraped_at` | `reviews.scraped_at` |

## 3. 更新方法

`reviews`と`restaurants`は、D1のバッチ処理でまとめて全件入れ替える。途中のSQLが失敗した場合は全体をロールバックし、更新前の口コミを維持する。口コミ一覧と最終取得日時は`review_list`から取得する。

```mermaid
flowchart LR
    C["定期実行または手動実行"] --> B["Browser Run"]
    B --> S["共通スクレイパー"]
    S --> T["restaurants"]
    S --> R["reviews"]
    T --> V["review_list"]
    R --> V
    V --> A["口コミ一覧API"]
```

## 4. マイグレーション運用

- 適用済みマイグレーションは書き換えない。
- スキーマ変更は新しい連番ファイルとして追加する。
- 本番適用前に対象データとロールバック方法を確認する。
- D1への適用は`wrangler d1 migrations apply`を使用する。
