import type { EmDashRuntime } from "emdash/middleware";
import type { Review } from "../reviews/review";
import { toCmsReviewData } from "./review-mapping";

type Cms = Pick<EmDashRuntime, "handleContentList" | "handleContentListTrashed" | "handleContentCreate">;

/** CMSライフサイクル経由で新規分だけ追加し、既存の編集・公開状態・ゴミ箱を保持する。 */
export class CmsReviewStore {
  constructor(private readonly cms: Cms) {}

  private async sourceIds() {
    const ids = new Set<string>();
    for (const trashed of [false, true]) {
      let cursor: string | undefined;
      do {
        const result = trashed
          ? await this.cms.handleContentListTrashed("reviews", { limit: 100, cursor })
          : await this.cms.handleContentList("reviews", { limit: 100, cursor });
        if (!result.success || !result.data) throw new Error("CMSの既存口コミを照合できませんでした。");
        for (const item of result.data.items) ids.add(String(item.data.source_id));
        cursor = result.data.nextCursor;
      } while (cursor);
    }
    return ids;
  }

  async importNew(reviews: Review[], scrapedAt: string) {
    const ids = await this.sourceIds();
    let addedCount = 0;
    for (const review of reviews) {
      if (ids.has(review.id)) continue;
      const result = await this.cms.handleContentCreate("reviews", {
        slug: review.id, status: "draft", data: toCmsReviewData(review, scrapedAt),
      });
      if (!result.success) {
        // 同時取り込みの一意制約競合だけを照合し直す。他の保存失敗は成功に変換しない。
        if (!["CONFLICT", "SLUG_CONFLICT"].includes(result.error?.code ?? "") || !(await this.sourceIds()).has(review.id)) {
          throw new Error(`口コミ ${review.id} の取り込みに失敗しました: ${result.error?.message}`);
        }
      } else {
        addedCount++;
      }
      ids.add(review.id);
    }
    return { count: reviews.length, addedCount, scrapedAt };
  }
}
