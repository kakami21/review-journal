import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// 外部CMSやD1へ接続せず、実APIと一時SQLiteでブラウザの往復を確認する。
const database = new DatabaseSync(":memory:");
database.exec(readFileSync(new URL("../migrations/emdash/0002_post_likes.sql", import.meta.url), "utf8"));
const server = await createServer({ configFile: false,
  plugins: [react(), tailwindcss(), { name: "likes-browser", configureServer(vite) { vite.middlewares.use(handle); } }],
  server: { host: "127.0.0.1", port: 4399, strictPort: true },
});
const { createHonoApp } = await server.ssrLoadModule("/src/lib/hono-app.ts");
const { D1PostLikeStore } = await server.ssrLoadModule("/src/lib/posts/d1-post-like-store.ts");
const db = { prepare: sql => ({ bind: (...values) => ({
  all: async () => ({ success: true, results: database.prepare(sql).all(...values) }),
  run: async () => { database.prepare(sql).run(...values); return { success: true }; },
}) }) };
const store = new D1PostLikeStore(db);
const secret = randomBytes(32).toString("hex");
const keys = new Map([["food", "reviews:cms-food"], ["manual-note", "entries:cms-note"]]);
const app = createHonoApp();
const dependencies = { getAll: async () => ({ reviews: [], lastUpdatedAt: null }), getPosts: async () => ({ posts: [], lastUpdatedAt: null }), postLikes: {
  store, secret: () => secret, allowUpdate: async () => true,
  resolve: async ids => new Map(ids.filter(id => keys.has(id)).map(id => [id, keys.get(id)])),
} };

/** 確認用URLだけを処理し、投票以外のAPIや外部サービスへの転送を作らない。 */
async function handle(request, response, next) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const result = await app.fetch(new Request(url, { method: request.method, headers }), dependencies);
    response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(await result.text()); return;
  }
  if (url.pathname === "/" || url.pathname === "/posts") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end(await server.transformIndexHtml(url.pathname, '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>いいね表示の確認</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/likes-browser.tsx"></script></body></html>')); return;
  }
  if (url.pathname === "/mobile") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>390px幅の表示確認</title></head><body style="margin:0"><iframe title="390px幅の投稿一覧" src="/posts" style="width:390px;height:844px;border:0"></iframe></body></html>'); return;
  }
  next();
}
await server.listen();
console.log("ブラウザ確認: http://127.0.0.1:4399/posts （終了時に確認データを破棄）");
