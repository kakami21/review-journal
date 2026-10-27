import { getEmDashCollection } from "emdash";
import { manualPost, tabelogPost, comparePosts } from "../posts/post";
import type { Post } from "../posts/post";
import { createCmsReviewApiDependencies } from "./review-api-dependencies";

/** 公開版専用クエリを使い、保存先の違いを共通Postの境界に閉じ込める。 */
export function createCmsPostApiDependencies(bindings: AstroBindings) {
  return {
    async getAll(): Promise<{ posts: Post[]; lastUpdatedAt: string | null }> {
      const { reviews, lastUpdatedAt } = await createCmsReviewApiDependencies(bindings).getAll(bindings as unknown as CloudflareBindings);
      const posts: Post[] = reviews.map(tabelogPost);
      let cursor: string | undefined;
      do {
        const result = await getEmDashCollection("posts", { limit: 100, cursor, status: "published" });
        if (result.error) throw result.error;
        posts.push(...result.entries.map(entry => manualPost(entry.data.id as string, entry.data)));
        cursor = result.nextCursor;
      } while (cursor);
      return { posts: posts.sort(comparePosts), lastUpdatedAt };
    },
  };
}
