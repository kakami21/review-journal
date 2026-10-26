import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getEmDashCollection } from "emdash";
import { withEmDashRuntime } from "emdash/middleware";
import { CmsReviewStore, publicReview } from "../../cms/review-store";
import { CloudflareBrowserProvider } from "../../infrastructure/cloudflare-browser-provider";
import { importCollectedReviews } from "../../reviews/import-collected-reviews";
import { TabelogReviewScraper } from "../../reviews/tabelog-review-scraper";
import { createReviewApi } from "../../worker/review-api";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  const api = createReviewApi({
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
  });
  return api.fetch(request, bindings);
};
