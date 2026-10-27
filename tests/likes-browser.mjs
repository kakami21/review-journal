import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const server = await createServer({ configFile: false,
  plugins: [react(), tailwindcss(), { name: "likes-browser", configureServer(vite) { vite.middlewares.use(handle); } }],
  server: { host: "127.0.0.1", port: 4399, strictPort: true },
});
const { createPostLikeApi } = await server.ssrLoadModule("/src/worker/post-like-api.ts");
const { createReviewApi } = await server.ssrLoadModule("/src/worker/review-api.ts");
const { D1PostLikeStore } = await server.ssrLoadModule("/src/infrastructure/d1-post-like-store.ts");
const { tabelogPost, entryPost } = await server.ssrLoadModule("/src/posts/post.ts");

// ブラウザ確認用。実APIと実SQLiteを接続し、CMSの公開投稿一覧だけを固定データにする。
const database = new DatabaseSync(":memory:");
database.exec(readFileSync(new URL("../astro/migrations/0002_post_likes.sql", import.meta.url), "utf8"));
const db = { prepare: sql => ({ bind: (...values) => ({
  all: async () => ({ success: true, results: database.prepare(sql).all(...values) }),
  run: async () => { database.prepare(sql).run(...values); return { success: true }; },
}) }) };
const store = new D1PostLikeStore(db);
const posts = [tabelogPost({ id: "123", name: "確認用の食べログ店舗", url: "https://example.com/shop", detailUrl: "https://example.com/review",
  title: "食べログの99いいねは表示しない", body: "このアプリの件数は0から始まります。", reviewDate: "2026-10", rating: 4, likeCount: 99 }),
  ...["note", "article", "review"].map(kind => entryPost(kind, {
    source: "manual", kind, title: kind === "article" ? "長い記事の表示確認" : null,
    body: kind === "article" ? "長い文章でもカード幅を超えずに読みやすく表示します。".repeat(12) : "タイトルなしのノートや手入力の口コミにもいいねできます。",
    written_at: "2026-10-27T00:00:00Z", restaurant_name: "手入力の店舗", review_month: "2026-10", rating: 3.5,
  })),
];
const keys = new Map(posts.map(post => [post.id, `${post.source}:${post.id}`]));
const secret = randomBytes(32).toString("hex");
const app = createReviewApi({ getAll: async () => ({ reviews: [], lastUpdatedAt: null }) }, createPostLikeApi({
  store, secret: () => secret, allowUpdate: async () => true,
  resolve: async ids => new Map(ids.filter(id => keys.has(id)).map(id => [id, keys.get(id)])),
}));
async function handle(request, response, next) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/posts") {
    const states = await store.read([...keys.values()], null);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ posts: posts.map(post => ({ ...post, likeCount: states.get(keys.get(post.id)).likeCount })), lastUpdatedAt: null })); return;
  }
  if (url.pathname.startsWith("/api/")) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
    const result = await app.fetch(new Request(url, { method: request.method, headers }));
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
