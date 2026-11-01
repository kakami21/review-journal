import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { selectPosts, type Post } from "../src/posts/post";
import { PostListPage } from "../src/react-app/pages/PostListPage";
import { setupEntries } from "../scripts/setup-entries.mjs";
import seed from "../seed/seed.json";

const mocks = vi.hoisted(() => ({ published: vi.fn(), runtime: vi.fn(), readLikes: vi.fn() }));
vi.mock("../src/infrastructure/d1-post-like-store", () => ({ D1PostLikeStore: class { read = mocks.readLikes; } }));
vi.mock("emdash", () => ({ getEmDashCollection: mocks.published }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: mocks.runtime }));
import { publicPost, getPublicPosts } from "../src/cms/public-posts";

const manual = (kind: Post["kind"] = "note", id = "01AAA"): Post => publicPost("entries", {
  id, kind, title: "手入力タイトル", body: "公開した本文", publishedAt: new Date("2026-10-31T20:00:00Z"),
});
const review = (): Post => publicPost("reviews", {
  id: "01BBB", source_id: "old-anchor", restaurant_name: "既存店舗", restaurant_url: "https://example.com/restaurant",
  source_url: "https://example.com/review", body: "既存口コミ本文", review_month: "2026-10", rating: 4, like_count: 9,
});

beforeEach(() => { vi.resetAllMocks(); mocks.runtime.mockResolvedValue(null); mocks.readLikes.mockImplementation(async (keys: string[]) => new Map(keys.map(key => [key, { likeCount: 2, liked: false }]))); });

describe("共通の公開投稿", () => {
  it("手入力3種類を取得元と分け、店舗情報なしでもノート・記事を表示できる", () => {
    for (const kind of ["review", "note", "article"] as const) expect(manual(kind)).toMatchObject({ id: "manual-01AAA", contentId: "01AAA", kind, source: "manual", collection: "entries", name: null, rating: null, likeCount: null });
    const html = renderToStaticMarkup(createElement(PostListPage, { initialData: { posts: [manual(), manual("article", "02")], lastUpdatedAt: null } }));
    expect(html).toContain("公開した本文");
    expect(html).toContain("ノート");
    expect(html).toContain("記事");
    expect(html).not.toContain("訪問</p>");
    expect(html).not.toContain("食べログのいいね");
  });
  it("既存アンカーと取得値を維持し、アプリ内の識別にはCMS不変IDを返す", () => {
    expect(review()).toMatchObject({ id: "old-anchor", contentId: "01BBB", rating: 4, likeCount: 9, source: "tabelog" });
    const html = renderToStaticMarkup(createElement(PostListPage, { initialData: { posts: [review()], lastUpdatedAt: "2026-10-31T20:00:00Z" } }));
    expect(html).toContain('id="old-anchor"');
    expect(html).toContain("2026/10 訪問");
    expect(html).toContain("食べログのいいね 9");
    expect(html).toContain("アプリのいいね");
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-label="既存店舗のいいね"');
    expect(html).toContain("2026/11/01");
  });
  it("種類で絞り込み、評価順は口コミだけを比較する", () => {
    const entries = [manual(), review(), { ...manual("review"), rating: 5 }];
    expect(selectPosts(entries, "note", "reviewDate").map(p => p.kind)).toEqual(["note"]);
    expect(selectPosts(entries, "all", "rating").map(p => p.rating)).toEqual([5, 4]);
    expect(entries).toHaveLength(3);
  });
  it("公開クエリだけを両コレクションで全ページ読み、編集データを参照しない", async () => {
    mocks.published.mockResolvedValueOnce({ entries: [{ data: { id: "01", source_id: "old" } }], nextCursor: "p2" })
      .mockResolvedValueOnce({ entries: [] }).mockResolvedValueOnce({ entries: [{ data: { id: "02", kind: "note", body: "公開版" } }] });
    const result = await getPublicPosts({} as AstroBindings);
    expect(result.posts.map(p => p.id)).toEqual(["old", "manual-02"]);
    expect(result.posts.map(p => p.appLikeCount)).toEqual([2, 2]);
    expect(mocks.readLikes).toHaveBeenCalledWith(["reviews:01", "entries:02"], null);
    expect(mocks.published.mock.calls).toEqual([
      ["reviews", { limit: 100, cursor: undefined, status: "published" }],
      ["reviews", { limit: 100, cursor: "p2", status: "published" }],
      ["entries", { limit: 100, cursor: undefined, status: "published" }],
    ]);
  });
  it("取得失敗を空投稿へ変換せず、エラー表示では0件を表示しない", async () => {
    mocks.published.mockResolvedValue({ error: new Error("失敗") });
    await expect(getPublicPosts({} as AstroBindings)).rejects.toThrow("失敗");
    const html = renderToStaticMarkup(createElement(PostListPage, { errorMessage: "投稿の取得に失敗しました。" }));
    expect(html).toContain('role="alert"'); expect(html).not.toContain("0件");
    expect(html).toContain('disabled=""');
  });
  it("0件は正常な空表示として案内する", () => {
    const html = renderToStaticMarkup(createElement(PostListPage, { initialData: { posts: [], lastUpdatedAt: null } }));
    expect(html).toContain("0件の投稿"); expect(html).toContain("表示する投稿はありません");
    expect(html).not.toContain('role="alert"');
  });
});

describe("手入力スキーマの追加", () => {
  it("既存の口コミに触れずentriesと必要フィールドだけを追加する", async () => {
    const api = vi.fn().mockResolvedValue({ items: [] });
    const definition = seed.collections.find(collection => collection.slug === "entries")!;
    expect(await setupEntries(api, definition)).toEqual({ collection: "entries", fields: 7 });
    expect(api.mock.calls.every(call => !call[0].includes("reviews"))).toBe(true);
    expect(api.mock.calls.filter(call => call[1] === "POST")).toHaveLength(8);
  });
  it("途中から再開しても作成済みフィールドを上書きしない", async () => {
    const definition = seed.collections.find(collection => collection.slug === "entries")!;
    const api = vi.fn().mockResolvedValue({}).mockResolvedValueOnce({ items: [{ slug: "entries" }] })
      .mockResolvedValueOnce({ items: definition.fields });
    await setupEntries(api, definition);
    expect(api.mock.calls.filter(call => call[1] === "POST")).toHaveLength(0);
  });
});
