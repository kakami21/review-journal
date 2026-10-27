import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { confirmLikeVisitor, loadLikeStates, updatePostLike } from "../src/react-app/post-likes-client";

let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  let previous = Promise.resolve();
  // Web Locksの同一ロックがタブ間でも直列になる契約をテスト用に接続する。
  vi.stubGlobal("navigator", { locks: { request: (_key: string, action: () => Promise<void>) => {
    const result = previous.then(action); previous = result.catch(() => {}); return result;
  } } });
});
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ブラウザのいいね操作", () => {
  it("初回の2操作でもCookie発行が並行せず、確認後だけ票を送る", async () => {
    let identified = false;
    let active = 0; let maxActive = 0;
    fetcher.mockImplementation(async (url: string) => {
      if (url === "/api/like-visitor") {
        active++; maxActive = Math.max(maxActive, active);
        await Promise.resolve(); active--;
        const confirmed = identified; identified = true; return json({ confirmed });
      }
      expect(identified).toBe(true);
      return json({ likeCount: 1, liked: true });
    });
    await Promise.all([updatePostLike("first", true), updatePostLike("second", true)]);
    expect(maxActive).toBe(1);
    expect(fetcher.mock.calls.filter(call => call[0] === "/api/like-visitor")).toHaveLength(3);
    expect(fetcher.mock.calls.filter(call => call[1]?.method === "PUT")).toHaveLength(2);
  });
  it("Cookieを利用できなければ票を送らない", async () => {
    fetcher.mockImplementation(async () => json({ confirmed: false }));
    await expect(updatePostLike("first", true)).rejects.toThrow("Cookie");
    expect(fetcher.mock.calls.every(call => call[0] === "/api/like-visitor")).toBe(true);
  });
  it("Web Locks非対応では別の識別方法へ切り替えない", async () => {
    vi.stubGlobal("navigator", {});
    await expect(confirmLikeVisitor()).rejects.toThrow("ブラウザ");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("Cookie確認の失敗時に追加を送らず、PUTとDELETEを使い分ける", async () => {
    fetcher.mockResolvedValueOnce(json({}, 500));
    await expect(updatePostLike("first", true)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce(json({ confirmed: true })).mockResolvedValueOnce(json({ likeCount: 0, liked: false }));
    expect(await updatePostLike("first", false)).toEqual({ likeCount: 0, liked: false });
    expect(fetcher.mock.calls.at(-1)?.[1].method).toBe("DELETE");
  });
  it("101投稿の状態取得は2リクエストにまとめ、共有キャッシュを使わない", async () => {
    fetcher.mockImplementation(async (url: string, options: RequestInit) => {
      expect(options.cache).toBe("no-store");
      const ids = new URL(url, "https://example.com").searchParams.get("ids")!.split(",");
      return json({ states: Object.fromEntries(ids.map(id => [id, { likeCount: 0, liked: false }])) });
    });
    const states = await loadLikeStates(Array.from({ length: 101 }, (_, i) => `post-${i}`));
    expect(fetcher).toHaveBeenCalledTimes(2); expect(Object.keys(states)).toHaveLength(101);
  });
  it("429や不正な応答を成功扱いにしない", async () => {
    fetcher.mockResolvedValueOnce(json({ confirmed: true })).mockResolvedValueOnce(json({}, 429));
    await expect(updatePostLike("first", true)).rejects.toThrow("しばらく");
    fetcher.mockResolvedValue(new Response("not json"));
    await expect(loadLikeStates(["first"])).rejects.toThrow();
  });
});
