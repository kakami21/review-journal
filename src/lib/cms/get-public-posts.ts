import { D1PostLikeStore } from "../posts/d1-post-like-store";
import { postLikeKey } from "../posts/post-likes";
import { getEmDashCollection } from "emdash";
import { publicPhoto } from "../posts/photo";
import type { Post } from "../posts/post";
import { ReviewSyncStore } from "./review-sync-store";
import { toPublicReview } from "./review-mapping";

/** CMSが閲覧者の権限に応じて選んだ公開版または編集用の下書きを表示形式へ変換する。 */
export function publicPost(collection: "reviews" | "entries", data: Record<string, unknown>): Post {
  if (typeof data.id !== "string" || !data.id) throw new Error("公開投稿のCMS IDがありません。");
  const published = data.publishedAt;
  const publishedAt = published instanceof Date ? published.toISOString() : typeof published === "string" ? published : null;
  if (collection === "reviews") {
    const review = toPublicReview(data);
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
    photo: publicPhoto(data.photo),
  };
}

/** 公開済み投稿を全ページ読む。EmDashは認証済みの編集モードだけ下書きと編集属性を返す。 */
export async function readPublishedPosts() {
  const posts: Post[] = [];
  for (const collection of ["reviews", "entries"] as const) {
    let cursor: string | undefined;
    do {
      const result = await getEmDashCollection(collection, { limit: 100, cursor, status: "published" });
      if (result.error) throw result.error;
      posts.push(...result.entries.map(entry => {
        const post = publicPost(collection, entry.data);
        if (entry.edit && Object.keys(entry.edit).length) {
          // Reactのハイドレーションにも渡せるよう、EmDashのProxyを通常の属性オブジェクトにする。
          post.edit = { entry: { ...entry.edit }, title: { ...entry.edit.title }, body: { ...entry.edit.body } };
        }
        return post;
      }));
      cursor = result.nextCursor;
    } while (cursor);
  }
  return posts;
}

/** 公開済みの投稿だけを集計し、Cookieなしでも初回HTMLにアプリ内件数を含める。 */
export async function getPublicPosts(bindings: AstroBindings) {
  const posts = await readPublishedPosts();
  const states = await new D1PostLikeStore(bindings.DB).read(posts.map(post => postLikeKey(post.collection, post.contentId)), null);
  const lastUpdatedAt = await new ReviewSyncStore(bindings.DB).getLastUpdatedAt();
  return { posts: posts.map(post => ({ ...post, appLikeCount: states.get(postLikeKey(post.collection, post.contentId))!.likeCount })), lastUpdatedAt };
}
