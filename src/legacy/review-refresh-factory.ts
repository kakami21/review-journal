import { CloudflareBrowserProvider } from "../lib/reviews/cloudflare-browser-provider";
import { D1ReviewRepository } from "./d1-review-repository";
import { RefreshReviews } from "./refresh-reviews";
import { TabelogReviewScraper } from "../lib/reviews/tabelog-review-scraper";

export function createReviewRefresh(env: CloudflareBindings) {
  return new RefreshReviews(
    new TabelogReviewScraper(
      new CloudflareBrowserProvider(env.BROWSER),
      env.TABELOG_USERNAME,
    ),
    new D1ReviewRepository(env.DB),
  );
}
