import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ published: vi.fn(), runtime: vi.fn(), first: vi.fn() }));
vi.mock("emdash", () => ({ getEmDashCollection: mocks.published }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: mocks.runtime }));
import { loadReviewPage } from "../src/lib/cms/review-page";

const bindings = { DB: { prepare: () => ({ first: mocks.first }) } } as unknown as AstroBindings;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.published.mockResolvedValue({ entries: [] });
  mocks.first.mockResolvedValue({ last_updated_at: "2026-11-01T00:00:00Z" });
  mocks.runtime.mockImplementation(async (callback) => callback({}));
});

describe("Astroの初回取得", () => {
  it("APIと同じ公開版の全ページと最終取得日時だけを取得する", async () => {
    mocks.published.mockResolvedValueOnce({ entries: [{ data: { source_id: "published", body: "公開本文", review_month: "2026-10" } }], nextCursor: "next" }).mockResolvedValueOnce({ entries: [] });
    const page = await loadReviewPage(bindings);
    expect(page.status).toBe(200);
    expect(page.props.data?.reviews).toHaveLength(1);
    expect(page.props.data?.reviews[0].body).toBe("公開本文");
    expect(page.props.data?.lastUpdatedAt).toBe("2026-11-01T00:00:00Z");
    expect(mocks.published.mock.calls).toEqual([
      ["reviews", { limit: 100, cursor: undefined, status: "published" }],
      ["reviews", { limit: 100, cursor: "next", status: "published" }],
    ]);
    expect(mocks.first).toHaveBeenCalledOnce();
  });

  it("正常な0件は200を返す", async () => {
    expect(await loadReviewPage(bindings)).toEqual({ status: 200, props: { data: { reviews: [], lastUpdatedAt: "2026-11-01T00:00:00Z" } } });
  });

  it.each(["collection", "timestamp"])("%sの失敗は内部情報を公開せず500と案内を返す", async (failure) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      if (failure === "collection") mocks.published.mockResolvedValue({ error: new Error("内部情報") });
      else mocks.first.mockRejectedValue(new Error("内部情報"));
      const page = await loadReviewPage(bindings);
      expect(page.status).toBe(500);
      expect(page.props.data).toBeUndefined();
      expect(page.props.errorMessage).toContain("口コミの取得に失敗しました");
      expect(page.props.errorMessage).not.toContain("内部情報");
    } finally { log.mockRestore(); }
  });
});
