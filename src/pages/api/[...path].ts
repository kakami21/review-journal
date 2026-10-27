import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createCmsReviewApiDependencies } from "../../cms/review-api-dependencies";
import { createReviewApi } from "../../worker/review-api";
import { createPostApi } from "../../worker/post-api";
import { createCmsPostApiDependencies } from "../../cms/post-api-dependencies";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  return createReviewApi(createCmsReviewApiDependencies(bindings), createPostApi(createCmsPostApiDependencies(bindings))).fetch(request, bindings);
};
