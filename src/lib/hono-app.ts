import { Hono } from "hono";
import { createPostLikeApi, type PostLikeDependencies } from "./post-like-api";
import { HTTPException } from "hono/http-exception";
import type { Post } from "./posts/post";
import type { Review } from "./reviews/review";

export type ReviewApiDependencies = {
  getPosts: () => Promise<{ posts: Post[]; lastUpdatedAt: string | null }>;
  getAll: () => Promise<{ reviews: Review[]; lastUpdatedAt: string | null }>;
};

export type HonoAppEnv = {
  Bindings: ReviewApiDependencies & { postLikes: PostLikeDependencies };
};

/** ルートだけを登録し、取得・保存処理はリクエストごとのContextから受け取る。 */
export function createHonoApp() {
  const app = new Hono<HonoAppEnv>();

  // GETでWorkerの稼働を確認し、キャッシュせずstatus: okを返す。
  app.get("/api/health", (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ status: "ok" });
  });

  // GETで公開済みの口コミと成功した最終収集日時を返す。
  app.get("/api/reviews", async (c) => {
    return c.json(await c.env.getAll());
  });

  // GETで公開版の口コミと手入力投稿を共通の表示モデルで返す。
  app.get("/api/posts", async (c) => {
    return c.json(await c.env.getPosts());
  });

  app.route("/", createPostLikeApi());

  // 定義のないアプリAPIを404のJSONとして返す。
  app.all("/api/*", (c) => {
    return c.json({ error: "APIが見つかりません。" }, 404);
  });

  // 認証拒否などのHTTP例外はステータスとヘッダーを保持し、予期しない障害だけ共通500へ変換する。
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      const response = error.getResponse();
      return c.newResponse(response.body, response);
    }

    console.error("Request failed", error);
    return c.json({ error: "処理に失敗しました。時間をおいて再度お試しください。" }, 500);
  });

  return app;
}

// 接続情報やCMSランタイムを保持せず、登録済みルートだけを全リクエストで共有する。
export const honoApp = createHonoApp();
