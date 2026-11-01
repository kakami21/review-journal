import { createPostLikeApi } from "../../worker/post-like-api";
import { createCmsPostLikeDependencies } from "../../cms/post-like-api-dependencies";
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createCmsReviewApiDependencies } from "../../cms/review-api-dependencies";
import { getPublicPosts } from "../../cms/public-posts";
import { createReviewApi } from "../../worker/review-api";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  return createReviewApi({ ...createCmsReviewApiDependencies(bindings), getPosts: () => getPublicPosts(bindings) }, createPostLikeApi(createCmsPostLikeDependencies(bindings))).fetch(request, bindings);
};
