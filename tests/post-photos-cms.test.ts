import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("virtual:emdash/config", () => ({ default: {} }));
vi.mock("virtual:emdash/object-cache", () => ({ objectCacheConfig: {}, createObjectCache: null }));
import { EmDashRuntime } from "emdash/internal/plugin-test-runtime";
import { SchemaRegistry } from "../node_modules/emdash/src/schema/registry";
import { createDialect } from "../node_modules/emdash/src/db/sqlite";
import { sqlite } from "emdash/db";
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
  const { fields, titleField, ...definition } = seed.collections.find(c => c.slug === "entries")!;
  await schema.createCollection(definition as never);
  for (const field of fields) await schema.createField("entries", field as never);
  await schema.updateCollection("entries", { titleField });
}, 30000);
afterAll(async () => { await runtime?.db.destroy(); });

describe("実CMSの画像公開版", () => {
  it("写真なしから追加・差し替え・取り外しでき、再公開までは以前の写真を返す", async () => {
    const created = await runtime.handleContentCreate("entries", { status: "draft", data: { kind: "note", title: "写真の確認", body: "本文" } });
    if (!created.success || !created.data) throw new Error(JSON.stringify(created));
    const id = created.data.item.id;
    expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
    const publishedPhoto = async () => {
      const result = await runtime.handleContentList("entries", { status: "published" });
      if (!result.success || !result.data) throw new Error(JSON.stringify(result));
      return result.data.items.find(item => item.id === id)?.data.photo;
    };
    expect(await publishedPhoto()).toBeUndefined();
    for (const photo of [
      { id: "one", provider: "local", width: 1200, height: 800, mimeType: "image/jpeg", filename: "one.jpg", alt: "横長写真", meta: { storageKey: "one.jpg" } },
      { id: "two", provider: "local", width: 800, height: 1200, mimeType: "image/jpeg", filename: "two.jpg", alt: "縦長写真", meta: { storageKey: "two.jpg" } },
      null,
    ]) {
      const before = await publishedPhoto();
      const updated = await runtime.handleContentUpdate("entries", id, { data: { photo } });
      expect(updated.success, JSON.stringify(updated)).toBe(true);
      expect(await publishedPhoto()).toEqual(before);
      expect((await runtime.handleContentPublish("entries", id, {})).success).toBe(true);
      if (photo) expect(await publishedPhoto()).toMatchObject(photo);
      else expect(await publishedPhoto()).toBeUndefined();
    }
  });
});
