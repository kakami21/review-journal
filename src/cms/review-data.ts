import type { Review } from "../reviews/review";
import { tabelogPost } from "../posts/post";

type CmsReviewData = {
  source_id: string; source_url: string; restaurant_name: string; restaurant_url: string;
  title: string | null; body: string | null; review_month: string;
  rating: number; like_count: number; imported_at: string;
};

export function reviewData(review: Review, importedAt: string): CmsReviewData {
  const post = tabelogPost(review);
  return {
    source_id: post.externalId, source_url: post.sourceUrl, restaurant_name: post.review.name,
    restaurant_url: post.review.url, title: post.title, body: post.body,
    review_month: post.date.value, rating: post.review.rating, like_count: review.likeCount,
    imported_at: importedAt,
  };
}

export function publicReview(data: Record<string, unknown>): Review {
  return {
    id: data.source_id as string, detailUrl: data.source_url as string,
    name: data.restaurant_name as string, url: data.restaurant_url as string,
    title: (data.title ?? null) as string | null, body: (data.body ?? null) as string | null,
    reviewDate: data.review_month as string, rating: data.rating as number,
    likeCount: data.like_count as number,
  };
}

