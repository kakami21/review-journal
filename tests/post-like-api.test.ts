import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPostLikeApi } from "../src/worker/post-like-api";
import { createReviewApi } from "../src/worker/review-api";
import type { PostLikeState } from "../src/posts/post-likes";

const origin = "https://example.com";
const secret = "test-only-secret-for-post-likes-1234567890";
const store = { read: vi.fn(), set: vi.fn() };
const resolve = vi.fn();
const allowUpdate = vi.fn();
const app = () => createReviewApi({ getAll: vi.fn() }, createPostLikeApi({ store, resolve, secret: () => secret, allowUpdate }));
const request = (path: string, method = "GET", cookie?: string, extra: Record<string, string> = {}) => app().request(`${origin}${path}`, {
  method, headers: { Origin: origin, "X-Post-Likes": "1", ...(cookie ? { Cookie: cookie } : {}), ...extra },
});
async function identify() {
  const first = await request("/api/like-visitor", "POST");
  expect(await first.json()).toEqual({ confirmed: false });
  const cookie = first.headers.get("Set-Cookie")!.split(";")[0];
  expect(await (await request("/api/like-visitor", "POST", cookie)).json()).toEqual({ confirmed: true });
  return { cookie, first };
}

beforeEach(() => {
  vi.resetAllMocks();
  resolve.mockImplementation(async (ids: string[]) => new Map(ids.filter(id => ["food", "manual-entry"].includes(id)).map(id => [id, `cms:${id}`])));
  store.read.mockImplementation(async (keys: string[], visitor: string | null) => new Map(keys.map(key => [key, { likeCount: 2, liked: visitor !== null }])));
  store.set.mockImplementation(async (_key, _visitor, liked: boolean): Promise<PostLikeState> => ({ likeCount: liked ? 3 : 2, liked }));
  allowUpdate.mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());

describe("匿名いいねAPI", () => {
  it("Cookie発行と確認だけでは票を作らず、必要なCookie属性を設定する", async () => {
    const { first } = await identify();
    const cookie = first.headers.get("Set-Cookie")!;
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=31536000"]) expect(cookie).toContain(attr);
    expect(cookie).not.toContain("Domain=");
    expect(first.headers.get("Cache-Control")).toBe("private, no-store");
    expect(store.set).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
  });
  it("未ログインでも公開Postの件数を一括で読み、Cookieなしでは押下済みを返さない", async () => {
    const response = await request("/api/post-likes?ids=food,manual-entry");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ states: { food: { likeCount: 2, liked: false }, "manual-entry": { likeCount: 2, liked: false } } });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(store.read).toHaveBeenCalledWith(["cms:food", "cms:manual-entry"], null);
  });
  it("PUTとDELETEは本人のCookieで解決した同じIDの票だけを操作する", async () => {
    const { cookie } = await identify();
    expect(await (await request("/api/post-likes/food", "PUT", cookie)).json()).toEqual({ likeCount: 3, liked: true });
    expect(await (await request("/api/post-likes/food", "DELETE", cookie)).json()).toEqual({ likeCount: 2, liked: false });
    expect(store.set.mock.calls[0][0]).toBe("cms:food");
    expect(store.set.mock.calls[0][1]).toBe(store.set.mock.calls[1][1]);
    expect(store.set.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  });
  it.each([undefined, "post_like_visitor=forged"])("未確認・改ざんCookieでは票を保存しない", async cookie => {
    expect((await request("/api/post-likes/food", "PUT", cookie)).status).toBe(403);
    expect(store.set).not.toHaveBeenCalled();
    expect(allowUpdate).not.toHaveBeenCalled();
  });
  it("署名が正しくても有効期限を過ぎたCookieは拒否する", async () => {
    const { cookie } = await identify();
    vi.useFakeTimers(); vi.setSystemTime(new Date(Date.now() + 366 * 86400000));
    expect((await request("/api/post-likes/food", "PUT", cookie)).status).toBe(403);
    expect(store.set).not.toHaveBeenCalled();
  });
  it.each(["https://evil.example", "null", ""])("別Origin・不明Originからの発行と更新を拒否する", async Origin => {
    const { cookie } = await identify();
    expect((await request("/api/like-visitor", "POST", cookie, { Origin })).status).toBe(403);
    expect((await request("/api/post-likes/food", "PUT", cookie, { Origin })).status).toBe(403);
    expect(store.set).not.toHaveBeenCalled();
  });
  it("クロスサイトの単純リクエストで操作できない", async () => {
    const { cookie } = await identify();
    expect((await request("/api/post-likes/food", "PUT", cookie, { "X-Post-Likes": "" })).status).toBe(403);
  });
  it("下書き・非公開・ゴミ箱・存在しないPostは公開解決できず操作も集計もしない", async () => {
    const { cookie } = await identify();
    for (const id of ["draft", "private", "trash", "missing"]) {
      expect((await request(`/api/post-likes/${id}`, "PUT", cookie)).status).toBe(404);
      expect((await request(`/api/post-likes?ids=${id}`, "GET", cookie)).status).toBe(404);
    }
    expect(store.set).not.toHaveBeenCalled(); expect(store.read).not.toHaveBeenCalled();
  });
  it("頻度制限超過は429となり保存しない", async () => {
    const { cookie } = await identify(); allowUpdate.mockResolvedValue(false);
    const response = await request("/api/post-likes/food", "PUT", cookie);
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(store.set).not.toHaveBeenCalled();
  });
  it("不正な一括取得と未対応メソッドを拒否する", async () => {
    for (const query of ["", "?ids=", `?ids=${Array(101).fill("food").join(",")}`]) {
      expect((await request(`/api/post-likes${query}`)).status).toBe(400);
    }
    expect((await request("/api/post-likes/food", "POST")).status).toBe(405);
    expect((await request("/api/like-visitor", "GET")).status).toBe(405);
    expect(store.read).not.toHaveBeenCalled();
  });
  it("DB障害・未設定の署名鍵を成功扱いにしない", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { cookie } = await identify(); store.set.mockRejectedValue(new Error("internal"));
      const response = await request("/api/post-likes/food", "PUT", cookie);
      expect(response.status).toBe(500); expect(await response.text()).not.toContain("internal");
      const invalid = createReviewApi({ getAll: vi.fn() }, createPostLikeApi({ store, resolve, secret: () => "", allowUpdate }));
      expect((await invalid.request(`${origin}/api/like-visitor`, { method: "POST", headers: { Origin: origin, "X-Post-Likes": "1" } })).status).toBe(500);
    } finally { log.mockRestore(); }
  });
});
