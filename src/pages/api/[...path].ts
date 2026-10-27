import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createCmsReviewApiDependencies } from "../../cms/review-api-dependencies";
import { createReviewApi } from "../../worker/review-api";
import { createPostApi } from "../../worker/post-api";
import { createCmsPostApiDependencies } from "../../cms/post-api-dependencies";
import { createPostLikeApi } from "../../worker/post-like-api";
import { createCmsPostLikeDependencies } from "../../cms/post-like-api-dependencies";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  const posts = createPostApi(createCmsPostApiDependencies(bindings));
  posts.route("/", createPostLikeApi(createCmsPostLikeDependencies(bindings)));
  return createReviewApi(createCmsReviewApiDependencies(bindings), posts).fetch(request, bindings);
};
