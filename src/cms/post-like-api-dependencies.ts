import { D1PostLikeStore } from "../infrastructure/d1-post-like-store";
import { readPublicPostCatalog } from "./post-catalog";

/** 識別子と公開判定をCMSで解決し、外から渡された保存キーを信用しない。 */
export function createCmsPostLikeDependencies(bindings: AstroBindings) {
  return {
    store: new D1PostLikeStore(bindings.DB),
    secret: () => bindings.POST_LIKE_SECRET,
    allowUpdate: async (visitorId: string) => (await bindings.POST_LIKE_LIMITER.limit({ key: `post-likes:${visitorId}` })).success,
    resolve: async (ids: string[]) => {
      const wanted = new Set(ids);
      return new Map((await readPublicPostCatalog()).filter(record => wanted.has(record.post.id))
        .map(record => [record.post.id, record.likeKey]));
    },
  };
}
