import { getEmDashCollection } from "emdash";
import { withEmDashRuntime } from "emdash/middleware";
import { CmsReviewStore, publicReview } from "./review-store";
import { CloudflareBrowserProvider } from "../infrastructure/cloudflare-browser-provider";
import { importCollectedReviews } from "../reviews/import-collected-reviews";
import { TabelogReviewScraper } from "../reviews/tabelog-review-scraper";
import type { ReviewApiDependencies } from "../worker/review-api";

/** CMSの公開参照と手動収集の接続を集約する。認証前には収集・保存を開始しない。 */
export function createCmsReviewApiDependencies(bindings: AstroBindings): ReviewApiDependencies {
  return {
    async getAll() {
      // 管理用の一覧APIは編集中データを含むため使わず、公開版専用のクエリをページ送りする。
      const reviews = [];
      let cursor: string | undefined;
      do {
        const result = await getEmDashCollection("reviews", { limit: 100, cursor, status: "published" });
        if (result.error) throw result.error;
        reviews.push(...result.entries.map((entry) => publicReview(entry.data)));
        cursor = result.nextCursor;
      } while (cursor);
      const lastUpdatedAt = await withEmDashRuntime((cms) => new CmsReviewStore(cms, bindings.DB).lastUpdatedAt());
      return { reviews: reviews.sort((a, b) => b.reviewDate.localeCompare(a.reviewDate)), lastUpdatedAt };
    },
    async refresh() {
      return importCollectedReviews(
        () => new TabelogReviewScraper(
          new CloudflareBrowserProvider(bindings.BROWSER), bindings.TABELOG_USERNAME,
        ).scrape(),
        (reviews, scrapedAt) => withEmDashRuntime((cms) => new CmsReviewStore(cms, bindings.DB)
          .importNew(reviews, scrapedAt)),
      );
    },
  };
}
