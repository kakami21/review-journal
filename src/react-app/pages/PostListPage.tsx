import { useEffect, useRef, useState } from "react";
import type { Post, PostContent, PostKind } from "../../posts/post";
import type { PostLikeState } from "../../posts/post-likes";
import { loadLikeStates, updatePostLike } from "../post-likes-client";

const kindLabels = { review: "口コミ", note: "ノート", article: "記事" };

/** 同じカードの枠を使い、店舗・評価だけを内容の種類に応じて追加する。 */
export function PostCard({ post, likeState, likeCount, pending = false, onLike }: {
  post: PostContent; likeState?: PostLikeState; likeCount?: number; pending?: boolean; onLike?: () => void;
}) {
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
        <button type="button" className="btn btn-sm" disabled={pending || !likeState || !onLike}
          aria-label={likeState?.liked ? "いいねを取り消す" : "いいね"} aria-pressed={likeState?.liked === true} onClick={onLike}>
          {likeState?.liked ? "♥" : "♡"} いいね {likeState ? likeState.likeCount : likeCount}
        </button>
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
  const [likeStates, setLikeStates] = useState<Record<string, PostLikeState>>({});
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [likeError, setLikeError] = useState("");
  const likeVersion = useRef(0);
  const pendingLikeIds = useRef(new Set<string>());
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
  useEffect(() => {
    if (!posts) return;
    const controller = new AbortController();
    const load = async () => {
      const version = likeVersion.current;
      try {
        const states = await loadLikeStates(posts.map(post => post.id), controller.signal);
        // 更新前に始まった取得結果で、成功した票の状態を巻き戻さない。
        if (version !== likeVersion.current || pendingLikeIds.current.size) return;
        setLikeStates(states); setLikeError("");
      } catch {
        if (!controller.signal.aborted && version === likeVersion.current) setLikeError("いいねの状態を取得できません。再読み込みしてください。");
      }
    };
    void load();
    const focused = () => { void load(); };
    window.addEventListener("focus", focused);
    return () => { controller.abort(); window.removeEventListener("focus", focused); };
  }, [posts]);

  async function like(id: string) {
    if (pendingLikeIds.current.has(id) || !likeStates[id]) return;
    pendingLikeIds.current.add(id);
    likeVersion.current++;
    setPendingLikes(current => new Set(current).add(id));
    setLikeError("");
    try {
      // 同じタブでも連打を抑え、全タブでCookie発行が終わってから票を送る。
      const updated = await updatePostLike(id, !likeStates[id].liked);
      setLikeStates(current => ({ ...current, [id]: updated }));
    } catch (e) {
      setLikeError(e instanceof Error ? e.message : "いいねの操作に失敗しました。");
    } finally {
      pendingLikeIds.current.delete(id);
      likeVersion.current++;
      setPendingLikes(current => { const next = new Set(current); next.delete(id); return next; });
    }
  }
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
      {likeError && <p role="alert" className="mb-4">{likeError}</p>}
      <ul className="space-y-4">{visible.map(post => <li key={post.id} id={post.id}>
        <PostCard post={post} likeState={likeStates[post.id]} likeCount={post.likeCount} pending={pendingLikes.has(post.id)} onLike={() => { void like(post.id); }} />
      </li>)}</ul>
    </div>
  </main>;
}
