import { createCmsPostLikeDependencies } from "../../lib/cms/post-like-api-dependencies";
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { getPublicReviews } from "../../lib/cms/get-public-reviews";
import { getPublicPosts } from "../../lib/cms/get-public-posts";
import { honoApp } from "../../lib/hono-app";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  return honoApp.fetch(request, {
    getAll: () => getPublicReviews(bindings.DB),
    getPosts: () => getPublicPosts(bindings),
    postLikes: createCmsPostLikeDependencies(bindings),
  });
};
