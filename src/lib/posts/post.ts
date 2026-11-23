import type { PostPhoto } from "./photo";
import type { EditProxy, FieldAnnotation } from "emdash";

export type PostKind = "review" | "note" | "article";

/** 通常は公開版、認証済みの編集モードでは下書きを表示する。URL用IDとCMS内の不変IDを分ける。 */
export type Post = {
  id: string;
  contentId: string;
  collection: "reviews" | "entries";
  kind: PostKind;
  source: "tabelog" | "manual";
  title: string | null;
  body: string | null;
  photo?: PostPhoto | null;
  publishedAt: string | null;
  name: string | null;
  url: string | null;
  reviewDate: string | null;
  rating: number | null;
  likeCount: number | null;
  appLikeCount?: number;
  edit?: {
    entry: EditProxy;
    title: Partial<FieldAnnotation>;
    body: Partial<FieldAnnotation>;
  };
};

/** 訪問年月のない投稿は公開日時で並べ、評価順では口コミだけを比較する。 */
export function selectPosts(posts: Post[], kind: PostKind | "all", sort: "reviewDate" | "rating") {
  const filtered = posts.filter(post => (kind === "all" || post.kind === kind)
    && (sort !== "rating" || post.kind === "review"));
  return filtered.sort((a, b) => sort === "rating"
    ? (b.rating ?? -1) - (a.rating ?? -1) || a.id.localeCompare(b.id)
    : (b.reviewDate ?? b.publishedAt ?? "").localeCompare(a.reviewDate ?? a.publishedAt ?? "") || a.id.localeCompare(b.id));
}
