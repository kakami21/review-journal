import { D1PostLikeStore } from "../infrastructure/d1-post-like-store";
import { postLikeKey } from "../posts/post-likes";
import { readPublishedPosts } from "./public-posts";

/** 保存キーは公開版の不変IDから作り、リクエストで渡されたIDを直接保存に使わない。 */
export function createCmsPostLikeDependencies(bindings: AstroBindings) {
  return {
    store: new D1PostLikeStore(bindings.DB),
    secret: () => bindings.POST_LIKE_SECRET,
    allowUpdate: async (visitorId: string) => (await bindings.POST_LIKE_LIMITER.limit({ key: `post-likes:${visitorId}` })).success,
    resolve: async (ids: string[]) => {
      const wanted = new Set(ids);
      return new Map((await readPublishedPosts()).filter(post => wanted.has(post.id))
        .map(post => [post.id, postLikeKey(post.collection, post.contentId)]));
    },
  };
}
