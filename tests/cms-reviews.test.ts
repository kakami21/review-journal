import { beforeEach, describe, expect, it, vi } from "vitest";
import { CmsReviewStore, publicReview, reviewData } from "../src/cms/review-store";

const review = { id: "B1", detailUrl: "https://tabelog.com/review/B1", name: "店舗",
  url: "https://tabelog.com/restaurant", title: null, body: "取得した本文", reviewDate: "2026-10", rating: 4, likeCount: 3 };
const timestamp = "2026-10-26T00:00:00.000Z";
const cms = {
  handleContentList: vi.fn(), handleContentListTrashed: vi.fn(), handleContentCreate: vi.fn(),
};
const run = vi.fn();
const bind = vi.fn(() => ({ run }));
const db = { prepare: vi.fn(() => ({ bind })) } as unknown as D1Database;
const store = () => new CmsReviewStore(cms as never, db);

beforeEach(() => {
  vi.clearAllMocks();
  cms.handleContentList.mockReset().mockResolvedValue({ success: true, data: { items: [] } });
  cms.handleContentListTrashed.mockReset().mockResolvedValue({ success: true, data: { items: [] } });
  cms.handleContentCreate.mockReset().mockResolvedValue({ success: true });
  run.mockReset().mockResolvedValue({ success: true });
});

describe("CMSの追加のみの取り込み", () => {
  it("新規分は下書きで追加し、取得件数・追加件数・成功日時を区別する", async () => {
    expect(await store().importNew([review], timestamp)).toEqual({ count: 1, addedCount: 1, scrapedAt: timestamp });
    expect(cms.handleContentCreate).toHaveBeenCalledWith("reviews", { slug: "B1", status: "draft", data: reviewData(review, timestamp) });
    expect(bind).toHaveBeenCalledWith(timestamp);
  });

  it.each([false, true])("既存口コミは編集中・公開・ゴミ箱とも上書きしない（ゴミ箱=%s）", async (trashed) => {
    const list = trashed ? cms.handleContentListTrashed : cms.handleContentList;
    list.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: "B1", body: "手動編集" } }] } });
    expect((await store().importNew([review], timestamp)).addedCount).toBe(0);
    expect(cms.handleContentCreate).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });

  it("照合は全ページを読み、2ページ目の登録済み項目も再追加しない", async () => {
    cms.handleContentList.mockResolvedValueOnce({ success: true, data: { items: [], nextCursor: "page2" } })
      .mockResolvedValueOnce({ success: true, data: { items: [{ data: { source_id: "B1" } }] } });
    await store().importNew([review], timestamp);
    expect(cms.handleContentCreate).not.toHaveBeenCalled();
  });

  it("途中保存失敗では成功日時を進めず、成功済み下書きは再実行時にスキップする", async () => {
    const other = { ...review, id: "B2" };
    cms.handleContentCreate.mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false, error: { code: "CONTENT_CREATE_ERROR", message: "失敗" } });
    await expect(store().importNew([review, other], timestamp)).rejects.toThrow("B2");
    expect(run).not.toHaveBeenCalled();
    cms.handleContentList.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: "B1" } }] } });
    cms.handleContentCreate.mockReset().mockResolvedValue({ success: true });
    expect((await store().importNew([review, other], timestamp)).addedCount).toBe(1);
    expect(cms.handleContentCreate.mock.calls[0][1].data.source_id).toBe("B2");
  });

  it.each(["CONFLICT", "SLUG_CONFLICT"])("並行実行の%sは登録済みIDを再照合して成功扱いにできる", async (code) => {
    cms.handleContentCreate.mockResolvedValue({ success: false, error: { code } });
    cms.handleContentList.mockResolvedValueOnce({ success: true, data: { items: [] } })
      .mockResolvedValueOnce({ success: true, data: { items: [{ data: { source_id: "B1" } }] } });
    expect((await store().importNew([review], timestamp)).addedCount).toBe(0);
  });

  it("別IDとの競合は同時取り込み成功と誤認しない", async () => {
    cms.handleContentCreate.mockResolvedValue({ success: false, error: { code: "CONFLICT" } });
    await expect(store().importNew([review], timestamp)).rejects.toThrow("B1");
    expect(run).not.toHaveBeenCalled();
  });

  it("0件の収集成功でも日時を記録する", async () => {
    expect((await store().importNew([], timestamp)).count).toBe(0);
    expect(run).toHaveBeenCalledOnce();
  });

  it("CMSと既存APIのID・null・年月・評価を変換して保持する", () => {
    expect(publicReview(reviewData(review, timestamp))).toEqual(review);
  });
});
