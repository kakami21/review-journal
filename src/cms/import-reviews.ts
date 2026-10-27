import { withEmDashRuntime } from "emdash/middleware";
import { CloudflareBrowserProvider } from "../infrastructure/cloudflare-browser-provider";
import { importCollectedReviews } from "../reviews/import-collected-reviews";
import { TabelogReviewScraper } from "../reviews/tabelog-review-scraper";
import { TabelogReviewStore } from "./tabelog-review-store";

export type ReviewImportResult =
  | { ok: true; count: number; addedCount: number; scrapedAt: string }
  | { ok: false; stage: "collection" | "save" };

/** 管理者認証後に呼び、収集失敗と一部保存の可能性がある失敗を区別する。 */
export async function importReviews(bindings: AstroBindings): Promise<ReviewImportResult> {
  let stage: "collection" | "save" = "collection";
  try {
    const result = await importCollectedReviews(
      () => new TabelogReviewScraper(
        new CloudflareBrowserProvider(bindings.BROWSER), bindings.TABELOG_USERNAME,
      ).scrape(),
      (reviews, scrapedAt) => {
        stage = "save";
        return withEmDashRuntime((cms) => new TabelogReviewStore(cms, bindings.DB).importNew(reviews, scrapedAt));
      },
    );
    return { ok: true, ...result };
  } catch {
    // 外部サイトの本文・内部の例外は管理画面へ返さず、再実行の判断に必要な段階だけを示す。
    console.error(`口コミ取り込みに失敗しました（${stage}）。`);
    return { ok: false, stage };
  }
}
