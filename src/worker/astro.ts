import { handle } from "@astrojs/cloudflare/handler";
import { createScheduledHandler } from "@emdash-cms/cloudflare/worker";

export default {
  // APIもAstroを通し、CMSのリクエストコンテキストと公開データ用クエリを利用する。
  fetch: handle,
  // CMSの公開予約・保守だけを実行する。口コミ収集は認証付き手動更新に限定する。
  scheduled: createScheduledHandler({ generalCron: "* * * * *" }),
} satisfies ExportedHandler<AstroBindings>;
