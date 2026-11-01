import type { Review } from "./review";

type ImportResult = { count: number; addedCount: number; scrapedAt: string };

/** 全件の収集が成功してからCMSへ渡す。収集・保存の失敗は成功結果へ変換しない。 */
export async function importCollectedReviews(
  collect: () => Promise<Review[]>,
  importNew: (reviews: Review[], scrapedAt: string) => Promise<ImportResult>,
) {
  const reviews = await collect();
  if (reviews.length === 0) throw new Error("口コミの取得結果が0件です。");
  return importNew(reviews, new Date().toISOString());
}
