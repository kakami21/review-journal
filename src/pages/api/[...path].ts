import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { createCmsReviewApiDependencies } from "../../lib/cms/review-api-dependencies";
import { createReviewApi } from "../../lib/review-api";

/** アプリAPIだけをHonoへ委譲する。CMS管理・認証ルートはEmDashの標準処理に任せる。 */
export const ALL: APIRoute = ({ request }) => {
  const bindings = env as unknown as AstroBindings;
  return createReviewApi(createCmsReviewApiDependencies(bindings)).fetch(request, bindings);
};
