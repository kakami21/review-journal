# データベースER図

現在のD1データベースは、店舗と口コミを分離した第三正規形（3NF）です。

```mermaid
erDiagram
    RESTAURANTS ||--o{ REVIEWS : "has"

    RESTAURANTS {
        text url PK "店舗URL"
        text name "店舗名"
    }

    REVIEWS {
        text id PK "口コミID"
        text restaurant_url FK "店舗URL"
        text detail_url UK "口コミ詳細URL"
        text title "口コミタイトル（任意）"
        text body "口コミ本文（任意）"
        text review_date "投稿日（YYYY-MM）"
        real rating "評価（0〜5）"
        integer like_count "いいね数"
        text scraped_at "取得日時"
    }
```

## 制約

- `restaurants.url`を店舗の主キーとする
- `reviews.id`を口コミの主キーとする
- `reviews.restaurant_url`は`restaurants.url`を参照する
- `reviews.detail_url`は一意とする
- `rating`は0以上5以下とする
- `like_count`は0以上とする
- `review_date`は`YYYY-MM`形式とする
- 外部キー`reviews.restaurant_url`にインデックスを持つ
- `reviews.review_date`の降順インデックスを持つ

## 設計方針

店舗名は`restaurants`だけに保持し、口コミから外部キーで参照します。各非キー属性は、そのテーブルの候補キーだけに依存するため、第三正規形を満たします。

## 読み取りビュー

`review_list`は`restaurants`と`reviews`を結合し、口コミ一覧API向けの読み取り形式を提供します。データは保持せず、書き込みには使用しません。

```mermaid
flowchart LR
    T["restaurants"] --> V["review_list"]
    R["reviews"] --> V
    V --> A["口コミ一覧API"]
```
