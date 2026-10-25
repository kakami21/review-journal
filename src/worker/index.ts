import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { HTTPException } from "hono/http-exception";
import { D1ReviewRepository } from "../infrastructure/d1-review-repository";
import { createReviewRefresh } from "./review-refresh-factory";

// Honoアプリケーションの作成
const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("/api/reviews/refresh", async (c, next) => {
  return basicAuth({
    username: c.env.BASIC_AUTH_USERNAME,
    password: c.env.BASIC_AUTH_PASSWORD,
  })(c, next);
});

// 口コミ手動更新API
app.post("/api/reviews/refresh", async (c) => {
  return c.json(await createReviewRefresh(c.env).execute());
});

// ヘルスチェックAPI
app.get("/api/health", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ status: "ok" });
});

// 口コミ取得API
app.get("/api/reviews", async (c) => {
  return c.json(await new D1ReviewRepository(c.env.DB).getAll());
});

// 404ハンドリング
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

// 定期実行のハンドラ
export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    console.log("口コミの定期更新を開始します");
    const result = await createReviewRefresh(env).execute();
    console.log("口コミの定期更新が完了しました", result);
  },
} satisfies ExportedHandler<CloudflareBindings>;
