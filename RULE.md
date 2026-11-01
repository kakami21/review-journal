# ドキュメント記述ルール

## 目的

コードの役割、HTTP APIの仕様、開発中の補足を、それぞれ適した方法で記録する。

## 基本方針

| 対象 | 使用するもの | 主な閲覧方法 |
| --- | --- | --- |
| 関数・型・クラス | JSDoc + TypeDoc | VS Codeのホバー表示、生成したHTML |
| HTTP API | OpenAPI + Swagger UI | ブラウザー上のAPI仕様画面 |
| 実装理由や注意事項 | 通常のコメント | ソースコード、VS Code |

コメントには、コードを読めば分かる処理の言い換えではなく、利用者が知る必要のある仕様や、コードだけでは分からない理由を書く。

## JSDoc

外部から利用される関数、型、クラスには、必要に応じてJSDocを書く。型や関数名から明らかな情報は繰り返さない。

### 関数の例

```ts
/**
 * 保存済みの口コミを取得する。
 *
 * @param env - D1などのCloudflareバインディング
 * @returns 口コミ一覧を格納したHTTPレスポンス
 */
export async function getReviews(env: AstroBindings): Promise<Response> {
  // ...
}
```

### 型の例

```ts
/** 口コミ一覧APIのレスポンス。 */
export type ReviewsResponse = {
  /** 取得した口コミ。 */
  reviews: Review[];
  /** 最終取得日時。 */
  lastUpdatedAt: string | null;
};
```

### TypeDocの役割

TypeDocはJSDocからHTMLドキュメントを生成するために使う。TypeDocを導入するまでは、同じJSDocをVS Codeのホバー表示と入力補完で確認する。

## OpenAPI

HTTPメソッド、パス、入力、レスポンス、ステータスコードはOpenAPIに記載する。ルート関数のJSDocだけをAPI仕様書の代わりにしない。

### `/api/reviews`の例

```yaml
/api/reviews:
  get:
    summary: 口コミ一覧を取得する
    responses:
      "200":
        description: 取得成功
      "500":
        description: 取得処理に失敗
```

### Swagger UIの役割

Swagger UIはOpenAPIを読み込み、APIの入力項目とレスポンスをブラウザー上で確認するために使う。OpenAPIとSwagger UIを導入した場合も、実装と仕様が食い違わないよう同時に更新する。

## 通常のコメント

通常のコメントは、実装上の意図、制約、処理順序が重要な箇所だけに書く。

### 良い例

```ts
// 未定義のAPIだけを404にし、画面へのアクセスは静的ファイルへ渡す。
app.all("/api/*", (c) => c.json({ error: "APIが見つかりません。" }, 404));
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));
```

### 避ける例

```ts
// 口コミを取得する。
app.get("/api/reviews", (c) => {
  return getReviews(c.env);
});
```

関数名と処理内容から目的が明らかなため、このコメントは追加情報にならない。

## 更新ルール

- 関数や型の公開仕様を変更したら、対応するJSDocも更新する。
- APIのパス、入力、出力、ステータスコードを変更したら、OpenAPIも更新する。
- コメントと実装が食い違った場合は、実装意図を確認して同じ変更内で修正する。
- 一時的な作業メモを恒久的なコメントとして残さない。
- TypeDoc、OpenAPI、Swagger UIは、必要になった時点で依存関係と公開方法を別途決めて導入する。
