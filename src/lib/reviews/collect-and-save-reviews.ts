import type { Review } from "./review";

type ImportResult = { count: number; addedCount: number; scrapedAt: string };

/** 全件の収集成功後に日時を付けて保存関数へ渡す。保存先には依存せず、失敗は呼び出し元へ伝える。 */
export async function collectAndSaveReviews(
  collect: () => Promise<Review[]>,
  importNew: (reviews: Review[], scrapedAt: string) => Promise<ImportResult>,
) {
  const reviews = await collect();
  if (reviews.length === 0) throw new Error("口コミの取得結果が0件です。");
  return importNew(reviews, new Date().toISOString());
}
