import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ published: vi.fn() }));
vi.mock("emdash", () => ({ getEmDashCollection: mocks.published }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: vi.fn() }));
import { createCmsPostLikeDependencies } from "../src/cms/post-like-api-dependencies";
const limit = vi.fn().mockResolvedValue({ success: true });
const dependencies = createCmsPostLikeDependencies({ DB: {}, POST_LIKE_SECRET: "not-used", POST_LIKE_LIMITER: { limit } } as unknown as AstroBindings);
beforeEach(() => { mocks.published.mockReset(); limit.mockClear(); });

it("表示用IDが異なっても不変CMS IDをキーにし、公開版だけを照合する", async () => {
  mocks.published.mockResolvedValueOnce({ entries: [{ data: { id: "cms-id", source_id: "review-anchor" } }] })
    .mockResolvedValueOnce({ entries: [{ data: { id: "entry-id", kind: "article" } }] });
  expect(await dependencies.resolve(["review-anchor", "manual-entry-id", "private"])).toEqual(new Map([["review-anchor", "reviews:cms-id"], ["manual-entry-id", "entries:entry-id"]]));
  expect(mocks.published.mock.calls.every(call => call[1].status === "published")).toBe(true);
});

it("非公開化後は解決できず、再公開後は同じ保存キーに戻る", async () => {
  const entry = { data: { id: "same-id", kind: "note" } };
  mocks.published.mockResolvedValueOnce({ entries: [] }).mockResolvedValueOnce({ entries: [entry] });
  expect((await dependencies.resolve(["manual-same-id"])).get("manual-same-id")).toBe("entries:same-id");
  mocks.published.mockResolvedValue({ entries: [] });
  expect(await dependencies.resolve(["manual-same-id"])).toEqual(new Map());
  mocks.published.mockResolvedValueOnce({ entries: [] }).mockResolvedValueOnce({ entries: [entry] });
  expect((await dependencies.resolve(["manual-same-id"])).get("manual-same-id")).toBe("entries:same-id");
});

it("CMS ID欠損を共有キーへ変換せず停止する", async () => {
  mocks.published.mockResolvedValue({ entries: [{ data: { source_id: "unknown" } }] });
  await expect(dependencies.resolve(["unknown"])).rejects.toThrow("CMS ID");
});

it("匿名識別子を頻度制限のキーへ接続する", async () => {
  expect(await dependencies.allowUpdate("visitor-id")).toBe(true);
  expect(limit).toHaveBeenCalledWith({ key: "post-likes:visitor-id" });
});
