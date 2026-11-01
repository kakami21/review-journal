import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Review } from "./reviews/review";

export type ReviewApiDependencies = {
  getAll: () => Promise<{ reviews: Review[]; lastUpdatedAt: string | null }>;
};

/** CMSの公開参照処理を受け取り、一覧とヘルスチェックのHTTP応答を返す。 */
export function createReviewApi(dependencies: ReviewApiDependencies) {
  const app = new Hono();

  // GETでWorkerの稼働を確認し、キャッシュせずstatus: okを返す。
  app.get("/api/health", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ status: "ok" });
  });

  // GETで公開済みの口コミと成功した最終収集日時を返す。
  app.get("/api/reviews", async (c) => {
    return c.json(await dependencies.getAll());
  });

  // 定義のないアプリAPIを404のJSONとして返す。
  app.all("/api/*", (c) => {
    return c.json({ error: "APIが見つかりません。" }, 404);
  });

  // 認証拒否などのHTTP例外はステータスとヘッダーを保持し、予期しない障害だけ共通500へ変換する。
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    console.error("Request failed", error);
    return c.json({ error: "処理に失敗しました。時間をおいて再度お試しください。" }, 500);
  });

  return app;
}
