import { CloudflareBrowserProvider } from "../infrastructure/cloudflare-browser-provider";
import { D1ReviewRepository } from "../infrastructure/d1-review-repository";
import { RefreshReviews } from "../reviews/refresh-reviews";
import { TabelogReviewScraper } from "../reviews/tabelog-review-scraper";

export function createReviewRefresh(env: CloudflareBindings) {
  return new RefreshReviews(
    new TabelogReviewScraper(
      new CloudflareBrowserProvider(env.BROWSER),
      env.TABELOG_USERNAME,
    ),
    new D1ReviewRepository(env.DB),
  );
}
