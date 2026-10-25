import type { TabelogReviewScraper } from "./tabelog-review-scraper";
import type { Review } from "./review";

export interface ReviewRepository {
  replaceAll(reviews: Review[], scrapedAt: string): Promise<void>;
}

export class RefreshReviews {
  constructor(
    private readonly scraper: TabelogReviewScraper,
    private readonly repository: ReviewRepository,
  ) {}

  async execute() {
    const reviews = await this.scraper.scrape();
    const scrapedAt = new Date().toISOString();
    await this.repository.replaceAll(reviews, scrapedAt);

    return { count: reviews.length, scrapedAt };
  }
}
