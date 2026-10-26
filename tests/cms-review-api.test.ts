import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const run = vi.fn();
  const first = vi.fn();
  const bind = vi.fn(() => ({ run }));
  return {
    run, first, bind,
    env: { BASIC_AUTH_USERNAME: "admin", BASIC_AUTH_PASSWORD: "test-password", TABELOG_USERNAME: "test",
      BROWSER: {}, DB: { prepare: vi.fn(() => ({ first, bind })) } },
    published: vi.fn(), runtime: vi.fn(), scrape: vi.fn(), browser: vi.fn(),
    cms: { handleContentList: vi.fn(), handleContentListTrashed: vi.fn(), handleContentCreate: vi.fn() },
  };
});

vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("emdash", () => ({ getEmDashCollection: mocks.published }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: mocks.runtime }));
vi.mock("../src/infrastructure/cloudflare-browser-provider", () => ({
  CloudflareBrowserProvider: class { constructor(binding: unknown) { mocks.browser(binding); } },
}));
vi.mock("../src/reviews/tabelog-review-scraper", () => ({
  TabelogReviewScraper: class { scrape = mocks.scrape; },
}));
import { ALL } from "../src/pages/api/[...path]";

const timestamp = "2026-10-26T00:00:00.000Z";
const review = { id: "tabelog-1", name: "店舗", url: "https://tabelog.com/restaurant/1/",
  detailUrl: "https://tabelog.com/rvwdtl/1/", title: null, body: "公開本文", reviewDate: "2026-10", rating: 4, likeCount: 3 };
const entry = (id: string, month: string) => ({ data: { source_id: id, restaurant_name: review.name,
  restaurant_url: review.url, source_url: review.detailUrl, title: null, body: review.body,
  review_month: month, rating: 4, like_count: 3 } });
const authorization = `Basic ${btoa("admin:test-password")}`;

// Astroの実API入口からHono・CMS接続・保存処理を通し、外部サービスの境界だけ差し替える。
const request = (path: string, init?: RequestInit) => ALL({ request: new Request(`https://example.com${path}`, init) } as never);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.DB.prepare.mockReturnValue({ first: mocks.first, bind: mocks.bind });
  mocks.bind.mockReturnValue({ run: mocks.run });
  mocks.run.mockResolvedValue({ success: true });
  mocks.first.mockResolvedValue({ last_updated_at: timestamp });
  mocks.published.mockResolvedValue({ entries: [], nextCursor: undefined });
  mocks.runtime.mockImplementation(async (callback) => callback(mocks.cms));
  mocks.cms.handleContentList.mockResolvedValue({ success: true, data: { items: [] } });
  mocks.cms.handleContentListTrashed.mockResolvedValue({ success: true, data: { items: [] } });
  mocks.cms.handleContentCreate.mockResolvedValue({ success: true });
  mocks.scrape.mockResolvedValue([review]);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("Astro・CMSのHTTP契約", () => {
  it("ヘルスチェックはCMS・DB・Browserを呼ばず200を返す", async () => {
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.runtime).not.toHaveBeenCalled();
    expect(mocks.published).not.toHaveBeenCalled();
    expect(mocks.env.DB.prepare).not.toHaveBeenCalled();
    expect(mocks.browser).not.toHaveBeenCalled();
  });

  it("公開クエリの全ページだけを読み、食べログID・null・日時と並び順を維持する", async () => {
    mocks.published.mockResolvedValueOnce({ entries: [entry("old", "2026-09")], nextCursor: "page2" })
      .mockResolvedValueOnce({ entries: [entry(review.id, review.reviewDate)] });
    const response = await request("/api/reviews");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reviews: [review, { ...review, id: "old", reviewDate: "2026-09" }], lastUpdatedAt: timestamp });
    expect(mocks.published.mock.calls).toEqual([
      ["reviews", { limit: 100, cursor: undefined, status: "published" }],
      ["reviews", { limit: 100, cursor: "page2", status: "published" }],
    ]);
    expect(mocks.cms.handleContentList).not.toHaveBeenCalled();
    expect(mocks.cms.handleContentListTrashed).not.toHaveBeenCalled();
    expect(mocks.cms.handleContentCreate).not.toHaveBeenCalled();
    expect(mocks.scrape).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("初回の公開一覧は空配列と未収集のnull日時を返す", async () => {
    mocks.first.mockResolvedValue(null);
    expect(await (await request("/api/reviews")).json()).toEqual({ reviews: [], lastUpdatedAt: null });
  });

  it.each([undefined, "Basic aW52YWxpZA=="])("未認証・誤認証ではCMSセッションCookieがあっても収集を始めない", async (auth) => {
    const response = await request("/api/reviews/refresh", { method: "POST",
      headers: { cookie: "emdash-session=test-session", ...(auth ? { authorization: auth } : {}) } });
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(mocks.browser).not.toHaveBeenCalled();
    expect(mocks.scrape).not.toHaveBeenCalled();
    expect(mocks.runtime).not.toHaveBeenCalled();
    expect(mocks.env.DB.prepare).not.toHaveBeenCalled();
  });

  it("Basic認証だけで手動更新でき、CMSへ下書き追加して件数と日時を返す", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(timestamp));
    const response = await request("/api/reviews/refresh", { method: "POST", headers: { authorization } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 1, addedCount: 1, scrapedAt: timestamp });
    expect(mocks.browser).toHaveBeenCalledWith(mocks.env.BROWSER);
    expect(mocks.cms.handleContentCreate).toHaveBeenCalledWith("reviews", expect.objectContaining({
      slug: review.id, status: "draft", data: expect.objectContaining({ source_id: review.id, body: review.body }),
    }));
    expect(mocks.bind).toHaveBeenCalledWith(timestamp);
    expect(mocks.published).not.toHaveBeenCalled();
  });

  it.each(["公開一覧", "収集", "保存"])("%sの失敗は内部情報を漏らさず共通500を返す", async (failure) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("内部情報を含む障害");
    if (failure === "公開一覧") mocks.published.mockResolvedValue({ error });
    if (failure === "収集") mocks.scrape.mockRejectedValue(error);
    if (failure === "保存") mocks.cms.handleContentCreate.mockResolvedValue({ success: false, error: { code: "ERROR", message: error.message } });
    const response = await request(failure === "公開一覧" ? "/api/reviews" : "/api/reviews/refresh",
      failure === "公開一覧" ? {} : { method: "POST", headers: { authorization } });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "処理に失敗しました。時間をおいて再度お試しください。" });
    expect(mocks.run).not.toHaveBeenCalled();
    if (failure === "収集") expect(mocks.cms.handleContentCreate).not.toHaveBeenCalled();
  });

  it("未知のAPIは外部サービスを呼ばずAPI用404を返す", async () => {
    const response = await request("/api/unknown");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "APIが見つかりません。" });
    expect(mocks.runtime).not.toHaveBeenCalled();
    expect(mocks.published).not.toHaveBeenCalled();
    expect(mocks.browser).not.toHaveBeenCalled();
  });
});
