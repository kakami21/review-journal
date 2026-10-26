import { D1ReviewRepository } from "../infrastructure/d1-review-repository";
import { createReviewRefresh } from "./review-refresh-factory";
import { createReviewApi } from "./review-api";

const app = createReviewApi({
  getAll: (env) => new D1ReviewRepository(env.DB).getAll(),
});

// 現行Vite本番の定期収集口を維持する。Astro側のCMS保守Cronとは接続しない。
export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    console.log("口コミの定期更新を開始します");
    const result = await createReviewRefresh(env).execute();
    console.log("口コミの定期更新が完了しました", result);
  },
} satisfies ExportedHandler<CloudflareBindings>;
