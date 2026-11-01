import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { publicPhoto } from "../src/lib/posts/photo";
import { PostListPage } from "../src/components/PostListPage";
vi.mock("emdash", () => ({ getEmDashCollection: vi.fn() }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: vi.fn() }));
import { publicPost } from "../src/lib/cms/public-posts";
import { setupEntries } from "../scripts/setup-entries.mjs";
import seed from "../seed/seed.json";

const photo = { id: "media-1", alt: "料理の写真", width: 1200, height: 800, meta: { storageKey: "2026/料理 1.jpg" } };

describe("手入力投稿の写真", () => {
  it("保存キーを標準配信URLへ変換し、寸法と説明を維持する", () => {
    expect(publicPhoto(photo)).toEqual({ url: "/_emdash/api/media/file/2026/%E6%96%99%E7%90%86%201.jpg", alt: "料理の写真", width: 1200, height: 800 });
    expect(publicPhoto(null)).toBeNull();
    expect(publicPhoto(undefined)).toBeNull();
    expect(() => publicPhoto({ id: "bad", src: "javascript:alert(1)" })).toThrow();
    expect(() => publicPhoto({ id: "missing" })).toThrow();
  });
  it.each(["review", "note", "article"])("%sの本文の下に写真を1枚表示する", kind => {
    const post = publicPost("entries", { id: "01", kind, title: "タイトル", body: "本文", photo });
    const html = renderToStaticMarkup(createElement(PostListPage, { initialData: { posts: [post], lastUpdatedAt: null } }));
    expect(html).toContain('alt="料理の写真"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('width="1200" height="800"');
    expect(html).toContain('class="h-auto max-w-full rounded"');
    expect(html.indexOf("本文")).toBeLessThan(html.indexOf("<img"));
    expect(html.match(/<img /g)).toHaveLength(1);
  });
  it("写真なしと食べログは画像枠を出さず、取り込みの取得値を維持する", () => {
    const manual = publicPost("entries", { id: "01", kind: "note", title: "ノート" });
    const review = publicPost("reviews", { id: "02", source_id: "external", restaurant_name: "店舗", rating: 4, like_count: 3, photo });
    expect(review.photo).toBeUndefined();
    expect(review.likeCount).toBe(3);
    const html = renderToStaticMarkup(createElement(PostListPage, { initialData: { posts: [manual, review], lastUpdatedAt: null } }));
    expect(html).not.toContain("<img");
  });
  it("既存スキーマには任意のphotoだけを追加し、再実行時に変更しない", async () => {
    const definition = seed.collections.find(c => c.slug === "entries")!;
    const fields = definition.fields.filter(f => f.slug !== "photo");
    const api = vi.fn(async (path: string, method = "GET", body?: any): Promise<any> => {
      if (path === "schema/collections") return { items: [{ slug: "entries" }] };
      if (path.endsWith("/fields") && method === "GET") return { items: fields };
      if (method === "POST") fields.push(body);
      return {};
    });
    await setupEntries(api, definition);
    await setupEntries(api, definition);
    expect(api.mock.calls.filter(call => call[1] === "POST")).toEqual([["schema/collections/entries/fields", "POST", { slug: "photo", label: "投稿の写真", type: "image", required: false, validation: null }]]);
    expect(api.mock.calls.every(call => !call[0].includes("reviews"))).toBe(true);
  });
});
