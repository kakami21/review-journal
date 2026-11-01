import { describe, expect, it, vi } from "vitest";
import { honoApp, type HonoAppEnv } from "../src/lib/hono-app";

type Dependencies = HonoAppEnv["Bindings"];
const dependencies = (label: string): Dependencies => ({
  getAll: async () => ({ reviews: [], lastUpdatedAt: label }),
  getPosts: async () => ({ posts: [], lastUpdatedAt: label }),
  postLikes: {
    secret: () => label.repeat(32),
    resolve: async () => new Map([["post", label]]),
    allowUpdate: async () => true,
    store: { set: vi.fn(), read: vi.fn(async () => new Map([[label, { likeCount: 1, liked: false }]])) },
  },
});

describe("共有Honoアプリのリクエスト分離", () => {
  it("先の取得が待機中でも、別リクエストの取得処理やレスポンスを混ぜない", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const first = dependencies("first");
    const entered = Promise.withResolvers<void>();
    first.getAll = async () => { entered.resolve(); await gate; return { reviews: [], lastUpdatedAt: "first" }; };
    const waiting = honoApp.request("https://example.com/api/reviews", undefined, first);
    await entered.promise;
    const second = await honoApp.request("https://example.com/api/reviews", undefined, dependencies("second"));
    expect(await second.json()).toEqual({ reviews: [], lastUpdatedAt: "second" });
    release();
    expect(await (await waiting).json()).toEqual({ reviews: [], lastUpdatedAt: "first" });
    const posts = await honoApp.request("https://example.com/api/posts", undefined, dependencies("third"));
    expect(await posts.json()).toEqual({ posts: [], lastUpdatedAt: "third" });
  });

  it("依存処理なしのhealth・404の後も、障害と正常応答の状態を持ち越さない", async () => {
    const health = await honoApp.request("https://example.com/api/health");
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get("Cache-Control")).toBe("no-store");
    expect((await honoApp.request("https://example.com/api/missing")).status).toBe(404);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failing = dependencies("failure");
      failing.getAll = async () => { throw new Error("internal"); };
      expect((await honoApp.request("https://example.com/api/reviews", undefined, failing)).status).toBe(500);
      const healthy = await honoApp.request("https://example.com/api/reviews", undefined, dependencies("healthy"));
      expect(healthy.status).toBe(200);
      expect(healthy.headers.get("Cache-Control")).toBeNull();
    } finally { log.mockRestore(); }
  });

  it("署名鍵・Cookie・保存先も各リクエストの依存処理だけを使う", async () => {
    const first = dependencies("first"), second = dependencies("second");
    const issued = await honoApp.request("https://example.com/api/like-visitor", {
      method: "POST", headers: { Origin: "https://example.com", "X-Post-Likes": "1" },
    }, first);
    const cookie = issued.headers.get("Set-Cookie")!.split(";")[0];
    await honoApp.request("https://example.com/api/post-likes?ids=post", { headers: { Cookie: cookie } }, second);
    expect(second.postLikes.store.read).toHaveBeenLastCalledWith(["second"], null);
    await honoApp.request("https://example.com/api/post-likes?ids=post", { headers: { Cookie: cookie } }, first);
    expect(first.postLikes.store.read).toHaveBeenLastCalledWith(["first"], expect.any(String));
  });
});
