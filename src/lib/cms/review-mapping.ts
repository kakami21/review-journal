import type { Review } from "../reviews/review";

type CmsReviewData = {
  source_id: string; source_url: string; restaurant_name: string; restaurant_url: string;
  title: string | null; body: string | null; review_month: string;
  rating: number; like_count: number; imported_at: string;
};

/** 収集元のID・本文・年月を保持して、CMSの下書き保存用フィールドへ変換する。 */
export function toCmsReviewData(review: Review, importedAt: string): CmsReviewData {
  return {
    source_id: review.id, source_url: review.detailUrl, restaurant_name: review.name,
    restaurant_url: review.url, title: review.title, body: review.body,
    review_month: review.reviewDate, rating: review.rating, like_count: review.likeCount,
    imported_at: importedAt,
  };
}

/** CMSの公開版を互換APIの口コミ形式へ戻し、省略された任意項目をnullに揃える。 */
export function toPublicReview(data: Record<string, unknown>): Review {
  return {
    id: data.source_id as string, detailUrl: data.source_url as string,
    name: data.restaurant_name as string, url: data.restaurant_url as string,
    title: (data.title ?? null) as string | null, body: (data.body ?? null) as string | null,
    reviewDate: data.review_month as string, rating: data.rating as number,
    likeCount: data.like_count as number,
  };
}

