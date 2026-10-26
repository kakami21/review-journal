import { describe, expect, it, vi } from "vitest";
import { createCmsClient, metadataSql, migrateReviews, parseSnapshot, verifyPublic } from "../scripts/migrate-reviews.mjs";
import { publicReview, reviewData } from "../src/cms/review-data";

const review = { id: "B1", name: "店舗", url: "https://tabelog.com/shop/", detailUrl: "https://tabelog.com/rvwdtl/B1/",
  title: null, body: "元の本文", reviewDate: "2026-10", rating: 4, likeCount: 2 };
const snapshot = { reviews: [review], lastUpdatedAt: "2026-10-26T00:00:00.000Z" };
function fixture(item?: Record<string, unknown>, trashed = false) {
  const items: any[] = item ? [item] : [];
  let failPublish = false;
  const api = vi.fn(async (path: string, method = "GET", body?: any): Promise<any> => {
    if (path.startsWith("content/reviews?")) return { items: trashed ? [] : items };
    if (path.startsWith("content/reviews/trash?")) return { items: trashed ? items : [] };
    if (path === "content/reviews" && method === "POST") {
      const created = { id: "cms-1", status: "draft", data: body.data };
      items.push(created);return { item: created };
    }
    if (path.endsWith("/publish")) {
      if (failPublish) throw new Error("保存障害");
      expect(body._rev).toBe("revision-1");
      items[0].status = "published";return { item: items[0] };
    }
    return { item: items[0], _rev: "revision-1" };
  });
  return { api, items, fail: (value: boolean) => { failPublish = value; } };
}

describe("既存公開口コミの一度限りの初期移行", () => {
  it("CMSが省略した任意の空欄を公開APIのnullに揃える", () => {
    const { title, body, ...data } = reviewData(review, snapshot.lastUpdatedAt);
    expect(publicReview(data)).toEqual({ ...review, title: null, body: null });
  });
  it("IDと本文を保持して下書き追加し、公開ライフサイクルを通す", async () => {
    const f = fixture();
    expect(await migrateReviews(snapshot, f.api)).toEqual({ count: 1, created: 1, published: 1 });
    expect(f.items[0].data).toEqual(reviewData(review, snapshot.lastUpdatedAt));
    expect(f.items[0].status).toBe("published");
    expect(await migrateReviews(snapshot, f.api)).toEqual({ count: 1, created: 0, published: 0 });
  });
  it.each(["編集済み", "ゴミ箱"])("%sとの衝突は書き込み前に停止する", async (state) => {
    const f = fixture({ id: "cms-1", status: "draft", data: { ...reviewData(review, snapshot.lastUpdatedAt), ...(state === "編集済み" ? { body: "手動編集" } : {}) } }, state === "ゴミ箱");
    await expect(migrateReviews(snapshot, f.api)).rejects.toThrow("競合");
    expect(f.api.mock.calls.every(([, method]) => method === undefined)).toBe(true);
  });
  it("公開途中の失敗後は追加済み下書きを再利用して再開する", async () => {
    const f = fixture();f.fail(true);
    await expect(migrateReviews(snapshot, f.api)).rejects.toThrow("保存障害");
    expect(f.items).toHaveLength(1);expect(f.items[0].status).toBe("draft");
    f.fail(false);
    expect(await migrateReviews(snapshot, f.api)).toEqual({ count: 1, created: 0, published: 1 });
  });
  it.each([
    { reviews: [] }, { reviews: [review, review] },
    { lastUpdatedAt: "2026-10-26'; DELETE FROM reviews;--" },
    { reviews: [{ ...review, reviewDate: "2026-13" }] },
  ])("不正な移行元を拒否する", (change) => expect(() => parseSnapshot({ ...snapshot, ...change })).toThrow());
  it("公開内容・件数・成功日時の不一致を検出する", () => {
    expect(() => verifyPublic(snapshot, snapshot)).not.toThrow();
    expect(() => verifyPublic(snapshot, { ...snapshot, reviews: [{ ...review, body: "違う本文" }] })).toThrow();
    expect(() => verifyPublic(snapshot, { ...snapshot, lastUpdatedAt: null })).toThrow();
    expect(metadataSql(snapshot)).toContain(snapshot.lastUpdatedAt);
    expect(metadataSql(snapshot)).not.toContain("ec_reviews");
  });
  it("Bearerを指定先のみに送り、HTTP接続とリダイレクトを制限する", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: {} })));
    await createCmsClient("https://cms.example", "test-token", fetcher)("content/reviews");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer test-token" } });
    expect(() => createCmsClient("http://cms.example", "token")).toThrow();
    expect(() => createCmsClient("https://other:token@cms.example", "token")).toThrow();
  });
});
