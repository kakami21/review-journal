import { Hono } from "hono";
import type { Post } from "../posts/post";

type Dependencies = { getAll: (env: CloudflareBindings) => Promise<{ posts: Post[]; lastUpdatedAt: string | null }> };

/** GETだけで公開投稿を返す。例外は親のAPIルーターで共通の500へ変換する。 */
export function createPostApi(dependencies: Dependencies) {
  const app = new Hono<{ Bindings: CloudflareBindings }>();
  app.get("/api/posts", async c => c.json(await dependencies.getAll(c.env)));
  return app;
}
