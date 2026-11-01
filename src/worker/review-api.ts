import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Post } from "../posts/post";
import type { Review } from "../reviews/review";

export type ReviewApiDependencies = {
  getPosts?: () => Promise<{ posts: Post[]; lastUpdatedAt: string | null }>;
  getAll: (env: CloudflareBindings) => Promise<{ reviews: Review[]; lastUpdatedAt: string | null }>;
};

/** 公開APIのHTTP応答を共通化し、現行D1とCMSの保存処理は呼び出し側で選ぶ。 */
export function createReviewApi(dependencies: ReviewApiDependencies) {
  const app = new Hono<{ Bindings: CloudflareBindings }>();

  // GETでWorkerの稼働を確認し、キャッシュせずstatus: okを返す。
  app.get("/api/health", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ status: "ok" });
  });

  // GETで公開済みの口コミと成功した最終収集日時を返す。
  app.get("/api/reviews", async (c) => {
    return c.json(await dependencies.getAll(c.env));
  });

  // GETで公開版の口コミと手入力投稿を返す。旧Workerでは共通投稿を公開しない。
  app.get("/api/posts", async (c) => {
    if (!dependencies.getPosts) return c.json({ error: "APIが見つかりません。" }, 404);
    return c.json(await dependencies.getPosts());
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
