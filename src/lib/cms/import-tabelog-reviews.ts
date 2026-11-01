import { withEmDashRuntime } from "emdash/middleware";
import { CloudflareBrowserProvider } from "../reviews/cloudflare-browser-provider";
import { collectAndSaveReviews } from "../reviews/collect-and-save-reviews";
import { TabelogReviewScraper } from "../reviews/tabelog-review-scraper";
import { ReviewSyncStore } from "./review-sync-store";
import { CmsReviewStore } from "./cms-review-store";

export type ReviewImportResult =
  | { ok: true; count: number; addedCount: number; scrapedAt: string }
  | { ok: false; stage: "collection" | "save" };

/** 管理者認証後に呼び、収集失敗と一部保存の可能性がある失敗を区別する。 */
export async function importTabelogReviews(bindings: AstroBindings): Promise<ReviewImportResult> {
  let stage: "collection" | "save" = "collection";
  try {
    const result = await collectAndSaveReviews(
      () => new TabelogReviewScraper(
        new CloudflareBrowserProvider(bindings.BROWSER), bindings.TABELOG_USERNAME,
      ).scrape(),
      async (reviews, scrapedAt) => {
        stage = "save";
        const saved = await withEmDashRuntime((cms) => new CmsReviewStore(cms).importNew(reviews, scrapedAt));
        // CMSへの全件保存が成功してから、別管理の収集日時を確定する。
        await new ReviewSyncStore(bindings.DB).recordSuccess(scrapedAt);
        return saved;
      },
    );
    return { ok: true, ...result };
  } catch {
    // 外部サイトの本文・内部の例外は管理画面へ返さず、再実行の判断に必要な段階だけを示す。
    console.error(`口コミ取り込みに失敗しました（${stage}）。`);
    return { ok: false, stage };
  }
}
