import { describe, expect, it, vi } from "vitest";
import { entryPost, tabelogPost, comparePosts } from "../src/posts/post";
import { PostCard } from "../src/react-app/pages/PostListPage";
import { renderToStaticMarkup } from "react-dom/server";
import { createPlugin } from "../src/cms/entry-policy";

const base = { source: "manual", kind: "note", body: " 本文\n2行目 ", written_at: "2026-10-27T00:00:00.000Z" };
const food = { id: "B1", detailUrl: "https://tabelog.com/reviews/B1", name: "店舗", url: "https://tabelog.com/shop",
  title: null, body: "口コミ", reviewDate: "2026-10", rating: 4, likeCount: 0 };

describe("共通Postと種類別の条件", () => {
  it("食べログは既存ID・本文・年月を維持し、取得元のいいね数を表示モデルへ混ぜない", () => {
    const post = tabelogPost(food);
    expect(post).toMatchObject({ id: "B1", kind: "review", source: "tabelog", body: food.body,
      externalId: "B1", date: { value: "2026-10", precision: "month" } });
    expect(post.review).not.toHaveProperty("likeCount");
    expect(entryPost("B1", base).id).not.toBe(post.id);
  });
  it("ノートは店舗・外部ID・外部URL不要で本文の空白を保持する", () => {
    expect(entryPost("memo", base)).toMatchObject({ kind: "note", source: "manual", body: base.body,
      review: null, externalId: null, sourceUrl: null });
  });
  it("手入力の口コミは外部URLやいいね数を必要としない", () => {
    expect(entryPost("review", { ...base, kind: "review", restaurant_name: "店舗", review_month: "2026-09", rating: 0 }))
      .toMatchObject({ kind: "review", source: "manual", review: { rating: 0, url: null } });
  });
  it("記事はタイトルと本文で保存できる", () => {
    expect(entryPost("article", { ...base, kind: "article", title: "技術記事" }).kind).toBe("article");
  });
  it.each([
    { ...base, source: "tabelog" }, { ...base, kind: "unknown" }, { ...base, body: "  " },
    { ...base, written_at: "2026-10" }, { ...base, kind: "article" },
    { ...base, kind: "review", rating: 4 },
    { ...base, kind: "review", restaurant_name: "店舗", review_month: "2026-13", rating: 4 },
    { ...base, kind: "review", restaurant_name: "店舗", review_month: "2026-10", rating: 6 },
    { ...base, restaurant_url: "javascript:alert(1)" },
  ])("不正な種類・取得元・日付・口コミの不足項目を拒否する", data => {
    expect(() => entryPost("invalid", data)).toThrow();
  });
  it("月精度の口コミを同月の日付付き投稿の後に置き、同順位はIDで固定する", () => {
    const items = [tabelogPost(food), entryPost("b", base), entryPost("a", base),
      tabelogPost({ ...food, id: "old", reviewDate: "2026-09" })];
    expect(items.sort(comparePosts).map(p => p.id)).toEqual(["manual-a", "manual-b", "B1", "old"]);
  });
  it("月境界と異なる時差は日本時間の表示と一致する順番で扱う", () => {
    const older = entryPost("older", { ...base, written_at: "2026-10-31T14:00:00Z" });
    const newer = entryPost("newer", { ...base, written_at: "2026-11-01T00:30:00+09:00" });
    const monthly = tabelogPost({ ...food, reviewDate: "2026-11" });
    expect([monthly, older, newer].sort(comparePosts).map(p => p.id)).toEqual(["manual-newer", "B1", "manual-older"]);
    expect(entryPost("minutes", { ...base, written_at: "2026-10-27T09:00+09:00" }).date.value).toBe("2026-10-27T00:00:00.000Z");
  });
  it("共通カードは本文をHTMLとして実行せず、種類に応じた項目だけを表示する", () => {
    const html = renderToStaticMarkup(<PostCard post={entryPost("note", { ...base, body: "<script>alert(1)</script>" })} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("いいね");
    expect(html).not.toContain("元の投稿");
    const liked = renderToStaticMarkup(<PostCard post={tabelogPost({ ...food, likeCount: 99 })} likeState={{ likeCount: 2, liked: true }} onLike={() => {}} />);
    expect(liked).toContain("いいね 2");
    expect(liked).not.toContain("99");
    expect(liked).toContain('aria-pressed="true"');
  });
});

describe("手入力投稿の公開規則", () => {
  const hooks = createPlugin().hooks!;
  const save = hooks["content:beforeSave"]!.handler;
  const publish = hooks["content:beforePublish"]!.handler;
  const schedule = hooks["content:beforeSchedule"]!.handler;
  it("新規下書きの取得元・種類・日時を初期化し、編集では日時を再生成しない", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(base.written_at));
    try {
      expect(await save({ collection: "entries", isNew: true, content: {} })).toMatchObject({ source: "manual", kind: "note", written_at: base.written_at });
      expect(await save({ collection: "entries", isNew: false, content: { body: "編集" } })).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
  it("取得元の偽装を拒否し、食べログの保存規則を変更しない", async () => {
    await expect(save({ collection: "entries", isNew: true, content: { source: "tabelog" } })).rejects.toThrow("manual");
    expect(await save({ collection: "reviews", isNew: true, content: {} })).toBeUndefined();
  });
  it.each([publish, schedule])("不足する下書きは公開も予約もできない", async handler => {
    expect(await handler({ collection: "entries", content: { data: { ...base, kind: "review" } } })).toMatchObject({ cancel: true });
    expect(await handler({ collection: "entries", content: { data: base } })).toBeUndefined();
    expect(await handler({ collection: "reviews", content: { data: {} } })).toBeUndefined();
  });
});
