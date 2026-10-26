import type { EmDashRuntime } from "emdash/middleware";
import type { Review } from "../reviews/review";

type Cms = Pick<EmDashRuntime, "handleContentList" | "handleContentListTrashed" | "handleContentCreate">;

type CmsReviewData = {
  source_id: string; source_url: string; restaurant_name: string; restaurant_url: string;
  title: string | null; body: string | null; review_month: string;
  rating: number; like_count: number; imported_at: string;
};

export function reviewData(review: Review, importedAt: string): CmsReviewData {
  return {
    source_id: review.id, source_url: review.detailUrl, restaurant_name: review.name,
    restaurant_url: review.url, title: review.title, body: review.body,
    review_month: review.reviewDate, rating: review.rating, like_count: review.likeCount,
    imported_at: importedAt,
  };
}

export function publicReview(data: Record<string, unknown>): Review {
  return {
    id: data.source_id as string, detailUrl: data.source_url as string,
    name: data.restaurant_name as string, url: data.restaurant_url as string,
    title: data.title as string | null, body: data.body as string | null,
    reviewDate: data.review_month as string, rating: data.rating as number,
    likeCount: data.like_count as number,
  };
}

/** CMSライフサイクル経由で新規分だけ追加し、既存の編集・公開状態・ゴミ箱を保持する。 */
export class CmsReviewStore {
  constructor(private readonly cms: Cms, private readonly db: D1Database) {}

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
        slug: review.id, status: "draft", data: reviewData(review, scrapedAt),
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
    // 全件成功後にだけ日時を進める。途中まで追加した下書きは再実行時に照合される。
    await this.db.prepare(`
      INSERT INTO app_review_sync (id, last_updated_at) VALUES (1, ?1)
      ON CONFLICT(id) DO UPDATE SET last_updated_at = MAX(last_updated_at, excluded.last_updated_at)
    `).bind(scrapedAt).run();
    return { count: reviews.length, addedCount, scrapedAt };
  }

  async lastUpdatedAt() {
    const row = await this.db.prepare("SELECT last_updated_at FROM app_review_sync WHERE id = 1")
      .first<{ last_updated_at: string }>();
    return row?.last_updated_at ?? null;
  }
}
