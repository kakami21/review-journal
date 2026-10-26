import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshReviews } from "../src/reviews/refresh-reviews";

const mocks = vi.hoisted(() => ({
  scrape: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../src/worker/review-refresh-factory", () => ({
  createReviewRefresh: () => new RefreshReviews({ scrape: mocks.scrape } as never, {
    replaceAll: mocks.save,
  }),
}));

import worker from "../src/worker/index";

const row = {
  id: "123", restaurant_name: "店舗", restaurant_url: "https://example.com/restaurant",
  detail_url: "https://example.com/review/123", title: null, body: "本文",
  review_date: "2026-10", rating: 4, like_count: 3,
};
const env = {
  DB: { prepare: () => ({
    all: async () => ({ results: [row] }),
    first: async () => ({ last_updated_at: "2026-10-25T00:00:00Z" }),
  }) },
} as unknown as CloudflareBindings;
const ctx = {} as ExecutionContext;

/** 実際の公開APIと旧取り込みAPIの廃止を通し、外部収集・保存だけをテスト用に置き換える。 */
const request = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://example.com${path}`, init), env, ctx);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.scrape.mockReset().mockResolvedValue([]);
  mocks.save.mockReset().mockResolvedValue(undefined);
});

describe("現行WorkerのHTTP契約", () => {

  it("ヘルスチェックは既存のJSONとキャッシュ抑止を維持する", async () => {
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("一覧は既存のID・本文・訪問年月・最終取得日時を維持する", async () => {
    const response = await request("/api/reviews");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reviews: [{ id: "123", name: "店舗", url: row.restaurant_url, detailUrl: row.detail_url,
        title: null, body: "本文", reviewDate: "2026-10", rating: 4, likeCount: 3 }],
      lastUpdatedAt: "2026-10-25T00:00:00Z",
    });
  });

  it.each([undefined, "Basic b2xkOnBhc3N3b3Jk"])("旧取り込みAPIは認証情報の有無にかかわらず実行できない", async (authorization) => {
    const response = await request("/api/reviews/refresh", {
      method: "POST", headers: authorization ? { authorization } : {},
    });
    expect(response.status).toBe(404);
    expect(mocks.scrape).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("旧構成の定期収集は従来の収集・保存の組み立てを維持する", async () => {
    const collected = [{ id: "123", name: "店舗", url: row.restaurant_url,
      detailUrl: row.detail_url, title: null, body: "本文", reviewDate: "2026-10",
      rating: 4, likeCount: 3 }];
    mocks.scrape.mockResolvedValueOnce(collected);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await worker.scheduled({} as never, env);
      expect(mocks.scrape).toHaveBeenCalledOnce();
      expect(mocks.save).toHaveBeenCalledWith(collected, expect.any(String));
    } finally { log.mockRestore(); }
  });

  it("未知のアプリAPIはHonoの404を返す", async () => {
    const response = await request("/api/unknown");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "APIが見つかりません。" });
  });
});
