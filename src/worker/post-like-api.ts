import { Hono } from "hono";
import type { Context } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import type { PostLikeStore } from "../posts/post-likes";

const cookieName = "post_like_visitor";
const lifetimeSeconds = 365 * 24 * 60 * 60;
type Dependencies = {
  store: PostLikeStore;
  resolve: (ids: string[]) => Promise<Map<string, string>>;
  secret: () => string;
  allowUpdate: (visitorId: string) => Promise<boolean>;
};

/** Cookie発行と票の保存を分け、同一オリジンから確認済みの閲覧者だけが操作できる。 */
export function createPostLikeApi(dependencies: Dependencies) {
  const app = new Hono<{ Bindings: AstroBindings }>();
  const secret = () => {
    const value = dependencies.secret();
    if (!value || value.length < 32) throw new Error("いいね用署名鍵を設定してください。");
    return value;
  };
  const visitor = async (c: Context): Promise<string | null> => {
    const signed = await getSignedCookie(c, secret(), cookieName);
    if (signed === undefined) return null;
    if (signed === false) throw new HTTPException(403, { message: "Cookieを確認できません。" });
    const parts = /^v1:([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}):(\d{13})$/.exec(signed);
    if (!parts || Number(parts[2]) <= Date.now()) throw new HTTPException(403, { message: "Cookieの有効期限を確認してください。" });
    return parts[1];
  };
  const requireOrigin = (c: Context) => {
    if (c.req.header("Origin") !== new URL(c.req.url).origin || c.req.header("X-Post-Likes") !== "1") {
      throw new HTTPException(403, { message: "このサイトから操作してください。" });
    }
  };
  // 他の閲覧者の押下状態や、Cookie発行結果が共有キャッシュへ残らないようにする。
  for (const path of ["/api/post-likes", "/api/post-likes/*", "/api/like-visitor"]) {
    app.use(path, async (c, next) => { c.header("Cache-Control", "private, no-store"); await next(); });
  }

  // POSTは識別Cookieだけを発行する。票は追加せず、次の往復で確認済みとなる。
  app.post("/api/like-visitor", async c => {
    requireOrigin(c);
    if (await visitor(c)) return c.json({ confirmed: true });
    const value = `v1:${crypto.randomUUID()}:${Date.now() + lifetimeSeconds * 1000}`;
    await setSignedCookie(c, cookieName, value, secret(), {
      httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Lax", path: "/", maxAge: lifetimeSeconds,
    });
    return c.json({ confirmed: false });
  });

  // GETは最大100件をまとめて読み、Cookieなしでも公開件数を返す。
  app.get("/api/post-likes", async c => {
    const ids = c.req.query("ids")?.split(",");
    if (!ids?.length || ids.length > 100 || ids.some(id => !id || id.length > 200)) {
      throw new HTTPException(400, { message: "対象の投稿IDを1〜100件指定してください。" });
    }
    const unique = [...new Set(ids)];
    const keys = await dependencies.resolve(unique);
    if (unique.some(id => !keys.has(id))) throw new HTTPException(404, { message: "公開投稿が見つかりません。" });
    const states = await dependencies.store.read([...keys.values()], await visitor(c));
    return c.json({ states: Object.fromEntries(unique.map(id => [id, states.get(keys.get(id)!)!])) });
  });

  // PUTは追加、DELETEは本人の票の取り消し。再送で反転するtoggle操作は提供しない。
  app.on(["PUT", "DELETE"], "/api/post-likes/:id", async c => {
    requireOrigin(c);
    const visitorId = await visitor(c);
    if (!visitorId) throw new HTTPException(403, { message: "Cookieの確認が必要です。" });
    if (!await dependencies.allowUpdate(visitorId)) throw new HTTPException(429, { message: "しばらく待ってから操作してください。" });
    const id = c.req.param("id");
    if (id.length > 200) throw new HTTPException(400, { message: "投稿IDが不正です。" });
    const key = (await dependencies.resolve([id])).get(id);
    if (!key) throw new HTTPException(404, { message: "公開投稿が見つかりません。" });
    return c.json(await dependencies.store.set(key, visitorId, c.req.method === "PUT"));
  });
  app.all("/api/like-visitor", c => { c.header("Allow", "POST"); return c.json({ error: "POSTで操作してください。" }, 405); });
  app.all("/api/post-likes/:id", c => { c.header("Allow", "PUT, DELETE"); return c.json({ error: "PUTかDELETEで操作してください。" }, 405); });
  return app;
}
