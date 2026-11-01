import { D1PostLikeStore } from "../infrastructure/d1-post-like-store";
import { postLikeKey } from "../posts/post-likes";
import { getEmDashCollection } from "emdash";
import { withEmDashRuntime } from "emdash/middleware";
import type { Post } from "../posts/post";
import { CmsReviewStore } from "./review-store";
import { publicReview } from "./review-data";

/** CMSの公開スナップショットを変換し、編集中の管理用データを参照しない。 */
export function publicPost(collection: "reviews" | "entries", data: Record<string, unknown>): Post {
  if (typeof data.id !== "string" || !data.id) throw new Error("公開投稿のCMS IDがありません。");
  const published = data.publishedAt;
  const publishedAt = published instanceof Date ? published.toISOString() : typeof published === "string" ? published : null;
  if (collection === "reviews") {
    const review = publicReview(data);
    return { ...review, contentId: String(data.id), collection, kind: "review", source: "tabelog", publishedAt };
  }
  if (!["review", "note", "article"].includes(String(data.kind))) throw new Error("投稿の種類が不正です。");
  return {
    id: `manual-${data.id}`, contentId: String(data.id), collection, source: "manual",
    kind: data.kind as Post["kind"], title: (data.title ?? null) as string | null,
    body: (data.body ?? null) as string | null, publishedAt,
    name: (data.restaurant_name ?? null) as string | null, url: (data.restaurant_url ?? null) as string | null,
    reviewDate: (data.review_month ?? null) as string | null, rating: (data.rating ?? null) as number | null,
    likeCount: null,
  };
}

/** 両コレクションの公開版を全ページ読み、片方の取得失敗も空一覧へ置き換えない。 */
export async function readPublishedPosts() {
  const posts: Post[] = [];
  for (const collection of ["reviews", "entries"] as const) {
    let cursor: string | undefined;
    do {
      const result = await getEmDashCollection(collection, { limit: 100, cursor, status: "published" });
      if (result.error) throw result.error;
      posts.push(...result.entries.map(entry => publicPost(collection, entry.data)));
      cursor = result.nextCursor;
    } while (cursor);
  }
  return posts;
}

/** 公開済みの投稿だけを集計し、Cookieなしでも初回HTMLにアプリ内件数を含める。 */
export async function getPublicPosts(bindings: AstroBindings) {
  const posts = await readPublishedPosts();
  const states = await new D1PostLikeStore(bindings.DB).read(posts.map(post => postLikeKey(post.collection, post.contentId)), null);
  const lastUpdatedAt = await withEmDashRuntime(cms => new CmsReviewStore(cms, bindings.DB).lastUpdatedAt());
  return { posts: posts.map(post => ({ ...post, appLikeCount: states.get(postLikeKey(post.collection, post.contentId))!.likeCount })), lastUpdatedAt };
}
