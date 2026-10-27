import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("virtual:emdash/config", () => ({ default: {} }));
vi.mock("virtual:emdash/object-cache", () => ({ objectCacheConfig: {}, createObjectCache: null }));
import { readFile } from "node:fs/promises";
import { EmDashRuntime } from "emdash/internal/plugin-test-runtime";
import { SchemaRegistry } from "../node_modules/emdash/src/schema/registry";
import { createDialect } from "../node_modules/emdash/src/db/sqlite";
import { sqlite } from "emdash/db";
import { createPlugin } from "../src/cms/entry-policy";
import { prepareEntries } from "../scripts/prepare-entries.mjs";
import { CompiledQuery } from "kysely";
import { D1PostLikeStore } from "../src/infrastructure/d1-post-like-store";
import { postLikeKey } from "../src/posts/post-likes";
import { TabelogReviewStore, reviewData } from "../src/cms/tabelog-review-store";
import { createPlugin as reviewPolicy } from "../src/cms/review-policy.mjs";

let runtime: EmDashRuntime;
let schema: SchemaRegistry;
let beforePreparation: string;
let afterPreparation: string;
const review = { id: "existing-food", detailUrl: "https://tabelog.com/rvwdtl/1/", name: "既存店舗", url: "https://tabelog.com/shop/1/",
  title: null, body: "元の口コミ", reviewDate: "2026-10", rating: 4, likeCount: 2 };
const data = { source: "manual", kind: "note", body: "公開する本文", written_at: "2026-10-27T00:00:00Z" };

beforeAll(async () => {
  runtime = await EmDashRuntime.create({
    config: { database: sqlite({ url: ":memory:" }), registry: false, fonts: false },
    plugins: [createPlugin(), reviewPolicy()], createDialect, createStorage: null,
    sandboxEnabled: false, sandboxedPluginEntries: [], createSandboxRunner: null,
    siteInfo: { url: "https://example.com", locale: "ja" },
  } as never);
  schema = new SchemaRegistry(runtime.db);
  const seed = JSON.parse(await readFile(new URL("../astro/seed/seed.json", import.meta.url), "utf8"));
  const legacy = seed.collections.find((c: { slug: string }) => c.slug === "reviews");
  const { fields: reviewFields, titleField: reviewTitleField, ...reviewCollection } = legacy;
  await schema.createCollection(reviewCollection);
  for (const field of reviewFields) await schema.createField("reviews", field);
  await schema.updateCollection("reviews", { titleField: reviewTitleField });
  const existing = await runtime.handleContentCreate("reviews", { slug: review.id, status: "draft", data: reviewData(review, data.written_at) });
  if (!existing.success) throw new Error(JSON.stringify(existing));
  await runtime.handleContentPublish("reviews", existing.data.item.id, {});
  await runtime.handleContentUpdate("reviews", existing.data.item.id, { data: { body: "編集中の口コミ" } });
  for (const state of ["draft", "scheduled", "trash"]) {
    const input = { ...review, id: `existing-${state}` };
    const created = await runtime.handleContentCreate("reviews", { slug: input.id, status: "draft", data: reviewData(input, data.written_at) });
    if (!created.success) throw new Error(JSON.stringify(created));
    if (state === "trash") expect((await runtime.handleContentDelete("reviews", created.data.item.id)).success).toBe(true);
    if (state === "scheduled") expect((await runtime.handleContentSchedule("reviews", created.data.item.id, "2099-01-01T00:00:00Z")).success).toBe(true);
  }
  const snapshot = async () => JSON.stringify({
    reviews: await runtime.db.selectFrom("ec_reviews" as never).selectAll().execute(),
    revisions: await runtime.db.selectFrom("revisions").selectAll().execute(),
  });
  beforePreparation = await snapshot();
  const definition = seed.collections.find((c: { slug: string }) => c.slug === "entries");
  const api = async (path: string, method = "GET", body?: any) => {
    if (path === "schema/collections" && method === "GET") return { items: await schema.listCollections() };
    if (path === "schema/collections" && method === "POST") return { item: await schema.createCollection(body) };
    if (path.endsWith("/fields") && method === "GET") {
      const collection = await schema.getCollection("entries");
      return { items: await schema.listFields(collection!.id) };
    }
    if (path.endsWith("/fields") && method === "POST") return { item: await schema.createField("entries", body) };
    if (path === "schema/collections/entries" && method === "PUT") return { item: await schema.updateCollection("entries", body) };
    throw new Error(`予期しない操作: ${path}`);
  };
  // 写真項目のない既存サイトを再現し、公開済み投稿を保持したまま項目を追加する。
  await prepareEntries(api, { ...definition, fields: definition.fields.filter((field: { slug: string }) => field.slug !== "photo") });
  const legacyEntry = await runtime.handleContentCreate("entries", { slug: "legacy-no-photo", status: "draft", data });
  if (!legacyEntry.success) throw new Error(JSON.stringify(legacyEntry));
  expect((await runtime.handleContentPublish("entries", legacyEntry.data.item.id, {})).success).toBe(true);
  beforePreparation = await snapshot();
  const entriesBefore = await runtime.db.selectFrom("ec_entries" as never).selectAll().execute();
  await prepareEntries(api, definition);
  await prepareEntries(api, definition);
  const entriesAfter = await runtime.db.selectFrom("ec_entries" as never).selectAll().execute();
  expect(entriesAfter.map(({ photo: _photo, ...entry }: any) => entry)).toEqual(entriesBefore);
  afterPreparation = await snapshot();
}, 30000);
afterAll(async () => { if (runtime) await runtime.db.destroy(); });

describe("実CMSでの手入力投稿", () => {
  it("写真なしの公開後に写真を追加・差し替え・取り外しでき、編集は再公開まで反映しない", async () => {
    const created = await runtime.handleContentCreate("entries", { status: "draft", data });
    if (!created.success) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    const publishedPhoto = async () => {
      const result = await runtime.handleContentList("entries", { status: "published" });
      if (!result.success) throw new Error(JSON.stringify(result));
      return result.data.items.find(item => item.id === id)?.data.photo;
    };
    for (const photo of [
      { id: "photo-1", provider: "local", width: 1200, height: 800, mimeType: "image/jpeg", filename: "first.jpg", alt: "最初の写真", meta: { storageKey: "first.jpg" } },
      { id: "photo-2", provider: "local", width: 800, height: 1200, mimeType: "image/jpeg", filename: "second.jpg", alt: "差し替え写真", meta: { storageKey: "second.jpg" } },
      null,
    ]) {
      const before = await publishedPhoto();
      const updated = await runtime.handleContentUpdate("entries", id, { data: { photo } });
      expect(updated.success, JSON.stringify(updated)).toBe(true);
      expect(await publishedPhoto()).toEqual(before);
      expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
      if (photo) expect(await publishedPhoto()).toMatchObject(photo);
      if (photo === null) expect(await publishedPhoto()).toBeUndefined();
    }
  });
  it("投稿の編集・スラッグ変更・非公開化・ゴミ箱・再公開でもアプリの票を保持する", async () => {
    const migration = await readFile(new URL("../astro/migrations/0002_post_likes.sql", import.meta.url), "utf8");
    await runtime.db.executeQuery(CompiledQuery.raw(migration));
    const db = { prepare: (sql: string) => ({ bind: (...parameters: unknown[]) => ({
      all: async () => ({ success: true, results: (await runtime.db.executeQuery(CompiledQuery.raw(sql, parameters))).rows }),
      run: async () => { await runtime.db.executeQuery(CompiledQuery.raw(sql, parameters)); return { success: true }; },
    }) }) } as unknown as D1Database;
    const likes = new D1PostLikeStore(db);
    const created = await runtime.handleContentCreate("entries", { slug: "likes-lifecycle", status: "draft", data });
    if (!created.success) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    const key = postLikeKey("entries", id);
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    await likes.set(key, "visitor", true);
    expect((await runtime.handleContentUpdate("entries", id, { slug: "renamed", data: { title: "編集したタイトル", body: "編集した本文" } })).success).toBe(true);
    expect((await runtime.handleContentUnpublish("entries", id, {})).success).toBe(true);
    expect((await runtime.handleContentDelete("entries", id)).success).toBe(true);
    expect((await runtime.handleContentRestore("entries", id)).success).toBe(true);
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    expect((await likes.read([key], "visitor")).get(key)).toEqual({ likeCount: 1, liked: true });
  });
  it("初期設定を再実行しても同じコレクションと項目を保持する", async () => {
    expect((await schema.listCollections()).map(c => c.slug).sort()).toEqual(["entries", "reviews"]);
    const collection = await schema.getCollection("entries");
    expect((await schema.listFields(collection!.id)).length).toBe(10);
    expect(afterPreparation).toBe(beforePreparation);
  });
  it("既存食べログの再取り込みは公開版・編集中の版を上書きせず、手入力へ混入しない", async () => {
    const run = vi.fn(async () => ({ success: true }));
    const db = { prepare: () => ({ bind: () => ({ run }) }) } as unknown as D1Database;
    const result = await new TabelogReviewStore(runtime, db).importNew([
      review, ...["draft", "scheduled", "trash"].map(state => ({ ...review, id: `existing-${state}` })),
    ], data.written_at);
    expect(result.addedCount).toBe(0);
    const resultList = await runtime.handleContentList("reviews", {});
    expect(resultList.success && resultList.data.items.find(item => item.data.source_id === review.id)?.data.body).toBe("元の口コミ");
  });
  it("タイトルもスラッグも指定しないノートを作成・公開できる", async () => {
    const created = await runtime.handleContentCreate("entries", { status: "draft", data: { body: "短いメモ" } });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error(JSON.stringify(created));
    expect(created.data.item.data).toMatchObject({ source: "manual", kind: "note" });
    expect((await runtime.handleContentPublish("entries", created.data.item.id, {})).success).toBe(true);
  });
  it.each(["note", "article", "review"])("%sを下書きから公開し、編集を公開版に混入させない", async kind => {
    const input = { ...data, kind, ...(kind === "article" ? { title: "記事" } : {}),
      ...(kind === "review" ? { restaurant_name: "店舗", review_month: "2026-10", rating: 4 } : {}) };
    const created = await runtime.handleContentCreate("entries", { slug: kind, status: "draft", data: input });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    expect((await runtime.handleContentUpdate("entries", id, { data: { body: "編集中の本文" } })).success).toBe(true);
    const published = await runtime.handleContentList("entries", { status: "published" });
    expect(published.success).toBe(true);
    if (published.success) expect(published.data.items.find(item => item.id === id)?.data.body).toBe(data.body);
  });
  it("口コミの不足項目は下書き保存できるが、公開・予約は拒否する", async () => {
    const created = await runtime.handleContentCreate("entries", { slug: "incomplete", status: "draft", data: { ...data, kind: "review" } });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(false);
    const scheduled = await runtime.handleContentSchedule("entries", id, "2099-01-01T00:00:00Z");
    expect(scheduled).toMatchObject({ success: false, error: { code: "SCHEDULE_REJECTED" } });
  });
});
