import { D1ReviewRepository } from "./d1-review-repository";
import { createReviewRefresh } from "./review-refresh-factory";
import { createReviewApi } from "../lib/review-api";

const app = createReviewApi({
  getAll: (env) => new D1ReviewRepository(env.DB).getAll(),
});

// 旧Workerの定期収集を保持する。現在のAstro側ではCMSの保守だけを実行する。
export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    console.log("口コミの定期更新を開始します");
    const result = await createReviewRefresh(env).execute();
    console.log("口コミの定期更新が完了しました", result);
  },
} satisfies ExportedHandler<CloudflareBindings>;
