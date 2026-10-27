import { withEmDashRuntime } from "emdash/middleware";
import { comparePosts } from "../posts/post";
import type { Post } from "../posts/post";
import { TabelogReviewStore } from "./tabelog-review-store";
import { readPublicPostCatalog } from "./post-catalog";
import { D1PostLikeStore } from "../infrastructure/d1-post-like-store";

/** 公開版専用クエリを使い、保存先の違いを共通Postの境界に閉じ込める。 */
export function createCmsPostApiDependencies(bindings: AstroBindings) {
  return {
    async getAll(): Promise<{ posts: Post[]; lastUpdatedAt: string | null }> {
      const records = await readPublicPostCatalog();
      const states = await new D1PostLikeStore(bindings.DB).read(records.map(record => record.likeKey), null);
      const posts = records.map(record => ({ ...record.post, likeCount: states.get(record.likeKey)!.likeCount }));
      const lastUpdatedAt = await withEmDashRuntime(cms => new TabelogReviewStore(cms, bindings.DB).lastUpdatedAt());
      return { posts: posts.sort(comparePosts), lastUpdatedAt };
    },
  };
}
