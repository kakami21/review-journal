import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createCmsReviewApiDependencies } from "../../lib/cms/review-api-dependencies";
import { getPublicPosts } from "../../lib/cms/public-posts";
import { createReviewApi } from "../../lib/review-api";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  return createReviewApi({ ...createCmsReviewApiDependencies(bindings), getPosts: () => getPublicPosts(bindings) }).fetch(request, bindings);
};
