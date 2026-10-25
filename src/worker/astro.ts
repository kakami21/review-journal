import { handle } from "@astrojs/cloudflare/handler";
import worker from "./index";

export default {
  ...worker,
  // アプリAPIだけをHonoへ渡す。ページと将来の /_emdash/* はAstro側で処理する。
  fetch(request, env, ctx) {
    return new URL(request.url).pathname.startsWith("/api/")
      ? worker.fetch(request, env, ctx)
      : handle(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareBindings>;
