import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("virtual:emdash/config", () => ({ default: {} }));
vi.mock("virtual:emdash/object-cache", () => ({ objectCacheConfig: {}, createObjectCache: null }));
vi.mock("astro:content", () => ({
  getLiveCollection: async (_name: string, filter: unknown) => {
    const { emdashLoader } = await import("emdash/runtime");
    return emdashLoader().loadCollection({ filter } as never);
  },
}));

import { runWithContext } from "emdash";
import { EmDashRuntime } from "emdash/internal/plugin-test-runtime";
import { SchemaRegistry } from "../node_modules/emdash/src/schema/registry";
import { createDialect } from "../node_modules/emdash/src/db/sqlite";
import { sqlite } from "emdash/db";
import { readPublishedPosts } from "../src/lib/cms/get-public-posts";
import { PostListPage } from "../src/components/PostListPage";
import seed from "../seed/seed.json";

let runtime: EmDashRuntime;
beforeAll(async () => {
  runtime = await EmDashRuntime.create({
    config: { database: sqlite({ url: ":memory:" }), registry: false, fonts: false },
    plugins: [], createDialect, createStorage: null,
    sandboxEnabled: false, sandboxedPluginEntries: [], createSandboxRunner: null,
    siteInfo: { url: "https://example.com", locale: "ja" },
  } as never);
  const schema = new SchemaRegistry(runtime.db);
  for (const { fields, titleField, ...definition } of seed.collections) {
    await schema.createCollection(definition as never);
    for (const field of fields) await schema.createField(definition.slug, field as never);
    await schema.updateCollection(definition.slug, { titleField });
  }
}, 30000);
afterAll(async () => { await runtime?.db.destroy(); });

const read = (editMode: boolean) => runWithContext({ editMode, db: runtime.db, dbIsIsolated: true }, readPublishedPosts);
const render = (posts: Awaited<ReturnType<typeof read>>) => renderToStaticMarkup(createElement(PostListPage, { initialData: { posts, lastUpdatedAt: null } }));

describe("投稿のインライン編集", () => {
  it.each(["reviews", "entries"] as const)("%sの本文・タイトルを正しいCMS IDで保存し、再読込と公開を分ける", async collection => {
    const created = await runtime.handleContentCreate(collection, { slug: `inline-${collection}`, status: "draft", data: collection === "entries"
      ? { kind: "note", title: "公開タイトル", body: "公開本文\n2行目" }
      : { source_id: "external-anchor", source_url: "https://example.com/review", restaurant_name: "店舗", restaurant_url: "https://example.com", title: "公開タイトル", body: "公開本文\n2行目", review_month: "2026-11", rating: 4, like_count: 2, imported_at: "2026-11-23T00:00:00Z" },
    });
    if (!created.success || !created.data) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await read(true)).some(post => post.contentId === id)).toBe(false);
    expect((await runtime.handleContentPublish(collection, id, {})).success).toBe(true);

    let editorPost = (await read(true)).find(post => post.contentId === id)!;
    expect(JSON.parse(editorPost.edit!.title["data-emdash-ref"]!)).toMatchObject({ collection, id, field: "title" });
    expect(JSON.parse(editorPost.edit!.body["data-emdash-ref"]!)).toMatchObject({ collection, id, field: "body" });
    expect(JSON.parse(JSON.stringify(editorPost))).toEqual(editorPost);
    expect(Object.getPrototypeOf(editorPost.edit!.entry)).toBe(Object.prototype);
    expect(render([editorPost])).toContain("data-emdash-ref=");

    for (const [field, value] of [["title", "編集したタイトル"], ["body", "編集した本文\n改行も保存"]]) {
      expect((await runtime.handleContentUpdate(collection, id, { data: { [field]: value } })).success).toBe(true);
    }
    const publicPost = (await read(false)).find(post => post.contentId === id)!;
    expect(publicPost).toMatchObject({ title: "公開タイトル", body: "公開本文\n2行目" });
    expect(publicPost.edit).toBeUndefined();
    expect(render([publicPost])).not.toContain("data-emdash-ref");

    editorPost = (await read(true)).find(post => post.contentId === id)!;
    expect(editorPost).toMatchObject({ title: "編集したタイトル", body: "編集した本文\n改行も保存" });
    expect(JSON.parse(JSON.stringify(editorPost.edit!.entry))["data-emdash-ref"]).toContain('"hasDraft":true');
    expect((await runtime.handleContentPublish(collection, id, {})).success).toBe(true);
    expect((await read(false)).find(post => post.contentId === id)).toMatchObject({ title: "編集したタイトル", body: "編集した本文\n改行も保存" });
  });

  it("空のタイトルと本文にも編集箇所を残し、案内文を保存値へ混ぜない", async () => {
    const created = await runtime.handleContentCreate("entries", { status: "draft", data: { kind: "note", title: "空の本文" } });
    if (!created.success || !created.data) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    const post = { ...(await read(true)).find(post => post.contentId === id)!, kind: "review" as const, title: null, body: null };
    const html = render([post]);
    expect(html).toContain('data-placeholder="タイトルを入力"');
    expect(html).toContain('data-placeholder="本文を入力"');
    expect(html).not.toContain(">タイトルを入力<");
    expect(html).not.toContain(">本文を入力<");
    expect(html.match(/data-emdash-ref=/g)).toHaveLength(3);
  });
});
