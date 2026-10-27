import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { D1PostLikeStore } from "../src/infrastructure/d1-post-like-store";
import { postLikeKey } from "../src/posts/post-likes";

let database: DatabaseSync;
let store: D1PostLikeStore;

// SQLは実SQLiteで実行し、WorkersのD1結果形式だけをテスト用に接続する。
beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../astro/migrations/0002_post_likes.sql", import.meta.url), "utf8"));
  const db = { prepare: (sql: string) => ({ bind: (...values: (string | null)[]) => ({
    all: async () => ({ success: true, results: database.prepare(sql).all(...values) }),
    run: async () => ({ success: true, meta: database.prepare(sql).run(...values) }),
  }) }) } as unknown as D1Database;
  store = new D1PostLikeStore(db);
});
afterEach(() => database.close());

describe("投稿の票の保存", () => {
  it("取得元で衝突せず、複数投稿の未登録件数を0として返す", async () => {
    const keys = [postLikeKey("reviews", "same"), postLikeKey("entries", "same")];
    expect(keys[0]).not.toBe(keys[1]);
    expect([...(await store.read(keys, null)).values()]).toEqual([{ likeCount: 0, liked: false }, { likeCount: 0, liked: false }]);
  });
  it("同時追加と再送を一意制約で1票に抑える", async () => {
    await Promise.all(Array.from({ length: 10 }, () => store.set("reviews:1", "visitor-a", true)));
    expect((await store.read(["reviews:1"], "visitor-a")).get("reviews:1")).toEqual({ likeCount: 1, liked: true });
    expect(database.prepare("SELECT COUNT(*) AS n FROM post_likes").get()?.n).toBe(1);
  });
  it("本人の票だけを取り消し、再削除でも他人の票や件数を壊さない", async () => {
    await store.set("entries:1", "a", true); await store.set("entries:1", "b", true);
    await store.set("entries:1", "a", false);
    expect(await store.set("entries:1", "a", false)).toEqual({ likeCount: 1, liked: false });
    expect(await store.set("missing", "a", false)).toEqual({ likeCount: 0, liked: false });
    expect((await store.read(["entries:1"], "b")).get("entries:1")?.liked).toBe(true);
  });
  it("空一覧と100件を超える一覧でも正しく集計する", async () => {
    expect(await store.read([], null)).toEqual(new Map());
    expect((await store.read(Array.from({ length: 150 }, (_, i) => `entries:${i}`), null)).size).toBe(150);
  });
  it("CMSや食べログの値には触れず、キーが同じなら編集・再公開後も票を保持する", async () => {
    database.exec("CREATE TABLE cms_snapshot (id TEXT, body TEXT, status TEXT, like_count INTEGER); INSERT INTO cms_snapshot VALUES ('1','本文','published',99)");
    const before = database.prepare("SELECT * FROM cms_snapshot").all();
    await store.set(postLikeKey("reviews", "1"), "a", true);
    expect(database.prepare("SELECT * FROM cms_snapshot").all()).toEqual(before);
    database.exec("UPDATE cms_snapshot SET body='編集', status='trash'; UPDATE cms_snapshot SET status='published'");
    expect((await store.read([postLikeKey("reviews", "1")], null)).get("reviews:1")?.likeCount).toBe(1);
  });
  it("キーが空の投稿は保存先の識別を作れない", () => {
    expect(() => postLikeKey("entries", "")).toThrow();
  });
});
