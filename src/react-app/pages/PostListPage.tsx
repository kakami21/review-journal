import { useState } from "react";
import { selectPosts, type Post, type PostKind } from "../../posts/post";

export type PostsResponse = { posts: Post[]; lastUpdatedAt: string | null };
const kinds = { all: "すべて", review: "口コミ", note: "ノート", article: "記事" } as const;

/** 種類の絞り込みと口コミの評価順を持つ共通一覧。既存口コミのアンカーIDを維持する。 */
export function PostListPage({ initialData, errorMessage = "" }: { initialData?: PostsResponse; errorMessage?: string }) {
  const data = initialData;
  const error = errorMessage;
  const [kind, setKind] = useState<PostKind | "all">("all");
  const [sort, setSort] = useState<"reviewDate" | "rating">("reviewDate");
  const posts = data ? selectPosts(data.posts, kind, sort) : [];
  return <main className="brutal min-h-screen bg-amber-50 px-4 py-10">
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-4xl font-bold">箱入レオのルーザー日記</h1>
        {data && <><p className="mt-2 opacity-70">{posts.length}件の投稿</p>
          <p className="mt-1 text-sm opacity-60">最終取得：{data.lastUpdatedAt ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(data.lastUpdatedAt)) : "未実行"}</p></>}
      </header>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <label>種類 <select className="select select-sm" aria-label="投稿の種類" value={kind} disabled={!data} onChange={event => { const next = event.target.value as PostKind | "all"; setKind(next); if (next === "note" || next === "article") setSort("reviewDate"); }}>
          {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <div className="flex flex-wrap gap-2" aria-label="投稿の並び順">
          <button className={`btn btn-sm ${sort === "reviewDate" ? "btn-primary" : "btn-ghost"}`} type="button" aria-pressed={sort === "reviewDate"} disabled={!data} onClick={() => setSort("reviewDate")}>新しい順</button>
          <button className={`btn btn-sm ${sort === "rating" ? "btn-primary" : "btn-ghost"}`} type="button" aria-pressed={sort === "rating"} disabled={!data || kind === "note" || kind === "article"} onClick={() => setSort("rating")}>口コミの評価順</button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {data && !posts.length && <p>表示する投稿はありません。</p>}
      <ul className="space-y-4">{posts.map(post => <li key={post.id} id={post.id}>
        <article className="card bg-base-100 shadow-sm"><div className="card-body min-w-0 break-words">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold">{post.kind === "review" && post.name ? (post.url ? <a className="link" href={post.url} target="_blank" rel="noreferrer">{post.name}</a> : post.name) : post.title}</h2>
            {post.kind === "review" && post.rating !== null && <span className="badge badge-primary shrink-0">{post.rating.toFixed(1)}</span>}
          </div>
          <p className="text-sm opacity-60">{kinds[post.kind]} · {post.source === "tabelog" ? "食べログ" : "手入力"}</p>
          {post.kind === "review" && post.title && <h3 className="font-bold">{post.title}</h3>}
          {post.body && <p className="whitespace-pre-wrap leading-relaxed">{post.body}</p>}
          <div className="flex flex-wrap justify-between gap-4 text-sm opacity-60">
            {post.kind === "review" && post.reviewDate ? <p>{post.reviewDate.replace("-", "/")} 訪問</p> : post.publishedAt && <p>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" }).format(new Date(post.publishedAt))} 公開</p>}
            {post.source === "tabelog" && <p>食べログのいいね {post.likeCount}</p>}
          </div>
        </div></article>
      </li>)}</ul>
    </div>
  </main>;
}
