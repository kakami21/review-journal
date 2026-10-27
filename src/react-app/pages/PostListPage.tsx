import { useEffect, useState } from "react";
import type { Post, PostKind } from "../../posts/post";

const kindLabels = { review: "口コミ", note: "ノート", article: "記事" };

/** 同じカードの枠を使い、店舗・評価だけを内容の種類に応じて追加する。 */
export function PostCard({ post }: { post: Post }) {
  const date = post.date.precision === "month"
    ? post.date.value.replace("-", "/")
    : new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(post.date.value));
  return <article className="card bg-base-100 shadow-sm">
    <div className="card-body">
      <div className="flex flex-wrap items-center gap-2 text-sm opacity-70">
        <span>{kindLabels[post.kind]}</span><span>{post.source === "tabelog" ? "食べログ" : "手入力"}</span>
      </div>
      {post.kind === "review" && <div className="flex items-start justify-between gap-4">
        <h2 className="text-xl font-bold">{post.review.url
          ? <a className="link" href={post.review.url} target="_blank" rel="noreferrer">{post.review.name}</a>
          : post.review.name}</h2>
        <span className="badge badge-primary">{post.review.rating.toFixed(1)}</span>
      </div>}
      {post.title && <h2 className="font-bold">{post.title}</h2>}
      {post.body && <p className="whitespace-pre-wrap break-words leading-relaxed">{post.body}</p>}
      <div className="flex flex-wrap justify-between gap-3 text-sm opacity-60">
        <time dateTime={post.date.value}>{date} {post.date.label === "visited" ? "訪問" : "投稿"}</time>
        {post.kind === "review" && post.review.likeCount !== null && <span>いいね {post.review.likeCount}</span>}
        {post.sourceUrl && <a className="link" href={post.sourceUrl} target="_blank" rel="noreferrer">元の投稿</a>}
      </div>
    </div>
  </article>;
}

/** 公開済みPostをまとめて読み、種類の絞り込みと口コミだけの評価順を提供する。 */
export function PostListPage() {
  const [posts, setPosts] = useState<Post[]>();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<PostKind | "all">("all");
  const [sort, setSort] = useState<"date" | "rating">("date");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/posts", { signal: controller.signal });
        if (!response.ok) throw new Error("投稿の取得に失敗しました。");
        const result = await response.json() as { posts: Post[]; lastUpdatedAt: string | null };
        setPosts(result.posts); setLastUpdatedAt(result.lastUpdatedAt);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "投稿の取得に失敗しました。");
      }
    }
    void load();
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!posts) return <p>読み込み中...</p>;
  const visible = posts.filter(post => kind === "all" || post.kind === kind);
  if (kind === "review" && sort === "rating") visible.sort((a, b) =>
    a.kind === "review" && b.kind === "review" ? b.review.rating - a.review.rating : 0);
  return <main className="brutal min-h-screen bg-amber-50 px-4 py-10">
    <div className="mx-auto max-w-3xl">
      <header className="mb-4">
        <h1 className="text-4xl font-bold">箱入レオのルーザー日記</h1>
        <p className="mt-2 opacity-70">{visible.length}件の投稿</p>
        <p className="mt-1 text-sm opacity-60">食べログ最終取得：{lastUpdatedAt
          ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "medium" }).format(new Date(lastUpdatedAt)) : "未実行"}</p>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label>種類 <select className="select select-sm" value={kind} onChange={e => { setKind(e.target.value as PostKind | "all"); setSort("date"); }}>
          <option value="all">すべて</option><option value="review">口コミ</option><option value="note">ノート</option><option value="article">記事</option>
        </select></label>
        {kind === "review" && <label>並び順 <select className="select select-sm" value={sort} onChange={e => setSort(e.target.value as "date" | "rating")}>
          <option value="date">日付順</option><option value="rating">評価順</option>
        </select></label>}
      </div>
      {visible.length === 0 && <p>公開された投稿はまだありません。</p>}
      <ul className="space-y-4">{visible.map(post => <li key={post.id} id={post.id}><PostCard post={post} /></li>)}</ul>
    </div>
  </main>;
}
