import type { Review } from "../reviews/review";
import { createCmsReviewApiDependencies } from "./review-api-dependencies";
import type { ReviewListProps } from "../react-app/pages/ReviewListPage";

export type ReviewsResponse = { reviews: Review[]; lastUpdatedAt: string | null };

/** 公開APIと同じクエリを使い、失敗は空一覧にせずページの500応答へ渡す。 */
export async function loadReviewPage(bindings: AstroBindings): Promise<{ status: number; props: ReviewListProps }> {
  try {
    const data = await createCmsReviewApiDependencies(bindings).getAll(bindings);
    return { status: 200, props: { data } };
  } catch (error) {
    console.error("Review page failed", error);
    return { status: 500, props: { errorMessage: "口コミの取得に失敗しました。時間をおいて再度お試しください。" } };
  }
}
