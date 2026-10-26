import { env } from "cloudflare:workers";
import { definePlugin } from "emdash";
import { importReviews } from "./import-reviews";

/** 管理画面の手動取り込みをEmDash標準の権限・CSRF検証を通るPOSTに限定する。 */
export function createPlugin() {
  return definePlugin({
    id: "review-import",
    version: "1.0.0",
    admin: {
      pages: [{ path: "/import", label: "口コミの取り込み", icon: "download" }],
    },
    routes: {
      run: {
        methods: ["POST"],
        permission: "plugins:manage",
        handler: async () => importReviews(env as unknown as AstroBindings),
      },
    },
  });
}
