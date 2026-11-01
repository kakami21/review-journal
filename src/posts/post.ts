export type PostKind = "review" | "note" | "article";

/** 公開版だけから作る共通カード。URL用IDとCMS内の不変IDを分ける。 */
export type Post = {
  id: string;
  contentId: string;
  collection: "reviews" | "entries";
  kind: PostKind;
  source: "tabelog" | "manual";
  title: string | null;
  body: string | null;
  publishedAt: string | null;
  name: string | null;
  url: string | null;
  reviewDate: string | null;
  rating: number | null;
  likeCount: number | null;
  appLikeCount?: number;
};

/** 訪問年月のない投稿は公開日時で並べ、評価順では口コミだけを比較する。 */
export function selectPosts(posts: Post[], kind: PostKind | "all", sort: "reviewDate" | "rating") {
  const filtered = posts.filter(post => (kind === "all" || post.kind === kind)
    && (sort !== "rating" || post.kind === "review"));
  return filtered.sort((a, b) => sort === "rating"
    ? (b.rating ?? -1) - (a.rating ?? -1) || a.id.localeCompare(b.id)
    : (b.reviewDate ?? b.publishedAt ?? "").localeCompare(a.reviewDate ?? a.publishedAt ?? "") || a.id.localeCompare(b.id));
}
