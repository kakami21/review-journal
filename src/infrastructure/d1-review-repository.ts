import type { ReviewRepository } from "../reviews/refresh-reviews";
import type { Review } from "../reviews/review";

type ReviewRow = {
  id: string;
  restaurant_name: string;
  restaurant_url: string;
  detail_url: string;
  title: string | null;
  body: string | null;
  review_date: string;
  rating: number;
  like_count: number;
};

export class D1ReviewRepository implements ReviewRepository {
  constructor(private readonly db: D1Database) {}

  async replaceAll(reviews: Review[], scrapedAt: string) {
    const insertRestaurant = this.db.prepare(`
      INSERT INTO restaurants (url, name)
      VALUES (?1, ?2)
    `);
    const insertReview = this.db.prepare(`
      INSERT INTO reviews (
        id,
        restaurant_url,
        detail_url,
        title,
        body,
        review_date,
        rating,
        like_count,
        scraped_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `);
    const restaurants = new Map(
      reviews.map((review) => [review.url, review.name]),
    );

    await this.db.batch([
      this.db.prepare("DELETE FROM reviews"),
      this.db.prepare("DELETE FROM restaurants"),
      ...restaurants.entries().map(([url, name]) =>
        insertRestaurant.bind(url, name),
      ),
      ...reviews.map((review) =>
        insertReview.bind(
          review.id,
          review.url,
          review.detailUrl,
          review.title,
          review.body,
          review.reviewDate,
          review.rating,
          review.likeCount,
          scrapedAt,
        ),
      ),
    ]);
  }

  async getAll() {
    const [reviewResult, metadata] = await Promise.all([
      this.db
        .prepare(`
          SELECT
            id,
            restaurant_name,
            restaurant_url,
            detail_url,
            title,
            body,
            review_date,
            rating,
            like_count
          FROM review_list
          ORDER BY review_date DESC
        `)
        .all<ReviewRow>(),
      this.db
        .prepare(`
          SELECT MAX(scraped_at) AS last_updated_at
          FROM review_list
        `)
        .first<{ last_updated_at: string | null }>(),
    ]);

    return {
      reviews: reviewResult.results.map((row) => ({
        id: row.id,
        name: row.restaurant_name,
        url: row.restaurant_url,
        detailUrl: row.detail_url,
        title: row.title,
        body: row.body,
        reviewDate: row.review_date,
        rating: row.rating,
        likeCount: row.like_count,
      } satisfies Review)),
      lastUpdatedAt: metadata?.last_updated_at ?? null,
    };
  }

}
