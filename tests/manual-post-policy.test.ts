import { describe, expect, it, vi } from "vitest";
vi.mock("emdash", () => ({ definePlugin: (plugin: unknown) => plugin,
  ContentSaveRejectedError: class extends Error {} }));
import { createPlugin } from "../src/lib/cms/review-policy.mjs";
const save = createPlugin().hooks["content:beforeSave"];
const event = (content: Record<string, unknown>) => ({ collection: "entries", isNew: true, content, id: "id" });

describe("管理画面の手入力保存", () => {
  it.each(["note", "article"])("%sは店舗名・年月・評価なしで保存できる", async kind => {
    await expect(save(event({ kind, title: "手入力", body: "本文" }), {})).resolves.toBeUndefined();
  });
  it("口コミは店舗名・訪問年月・評価を要求する", async () => {
    await expect(save(event({ kind: "review", title: "口コミ" }), {})).rejects.toThrow("店舗名");
    await expect(save(event({ kind: "review", restaurant_name: "店舗", review_month: "2026-10", rating: 0 }), {})).resolves.toBeUndefined();
  });
  it.each(["2026-13", "2026-1", "2026-10-01"])("不正な訪問年月%sは保存しない", async review_month => {
    await expect(save(event({ kind: "review", restaurant_name: "店舗", review_month, rating: 4 }), {})).rejects.toThrow("訪問年月");
  });
  it("部分更新は保存済みの種類と口コミ項目を合わせて検証する", async () => {
    const ctx = { content: { get: vi.fn().mockResolvedValue({ data: { kind: "review", restaurant_name: "店舗", review_month: "2026-10", rating: 4 } }) } };
    await expect(save({ ...event({ title: "変更" }), isNew: false }, ctx)).resolves.toBeUndefined();
    await expect(save({ ...event({ rating: null }), isNew: false }, ctx)).rejects.toThrow("評価");
  });
  it("種類を定義外へ変更できない", async () => {
    await expect(save(event({ kind: "other" }), {})).rejects.toThrow("種類");
  });
});
