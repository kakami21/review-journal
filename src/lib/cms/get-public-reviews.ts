import { getEmDashCollection } from "emdash";
import { toPublicReview } from "./review-mapping";
import { ReviewSyncStore } from "./review-sync-store";

/** APIとAstroの両方で公開版を全ページ読み、取得失敗を空一覧へ変換しない。 */
export async function getPublicReviews(db: D1Database) {
  const reviews = [];
  let cursor: string | undefined;
  do {
    const result = await getEmDashCollection("reviews", { limit: 100, cursor, status: "published" });
    if (result.error) throw result.error;
    reviews.push(...result.entries.map((entry) => toPublicReview(entry.data)));
    cursor = result.nextCursor;
  } while (cursor);
  const lastUpdatedAt = await new ReviewSyncStore(db).getLastUpdatedAt();
  return { reviews: reviews.sort((a, b) => b.reviewDate.localeCompare(a.reviewDate)), lastUpdatedAt };
}
