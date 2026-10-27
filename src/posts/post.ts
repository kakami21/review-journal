import { z } from "zod";
import type { Review } from "../reviews/review";

export const postKinds = ["review", "note", "article"] as const;
export type PostKind = typeof postKinds[number];
type PostBase = {
  id: string;
  title: string | null;
  body: string | null;
  date: { value: string; precision: "month" | "datetime"; label: "visited" | "written" };
};
export type TabelogPost = PostBase & {
  kind: "review"; source: "tabelog"; externalId: string; sourceUrl: string;
  review: { name: string; url: string; rating: number; likeCount: number };
};
export type Post = TabelogPost | PostBase & { source: "manual"; externalId: null; sourceUrl: null } & (
  | { kind: "review"; review: { name: string; url: string | null; rating: number; likeCount: number | null } }
  | { kind: "note" | "article"; review: null }
);

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const optionalText = z.string().nullish();
const entryDataSchema = z.object({
  source: z.literal("manual"), kind: z.enum(postKinds),
  title: optionalText, body: z.string().refine(value => value.trim().length > 0, "本文を入力してください。"),
  written_at: z.iso.datetime({ offset: true }).or(z.iso.datetime({ offset: true, precision: -1 })),
  restaurant_name: optionalText, restaurant_url: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).nullish(),
  review_month: z.union([month, z.literal("")]).nullish(),
  rating: z.number().min(0).max(5).nullish(),
}).superRefine((data, ctx) => {
  const require = (valid: boolean, path: string, message: string) => {
    if (!valid) ctx.addIssue({ code: "custom", path: [path], message });
  };
  if (data.kind === "review") {
    require(Boolean(data.restaurant_name?.trim()), "restaurant_name", "口コミには店舗名が必要です。");
    require(Boolean(data.review_month), "review_month", "口コミには訪問年月が必要です。");
    require(data.rating != null, "rating", "口コミには評価が必要です。");
  }
  if (data.kind === "article") require(Boolean(data.title?.trim()), "title", "記事にはタイトルが必要です。");
});

/** 食べログのID・年月・本文を変えず、取得元固有のReviewを共通表示用Postへ変換する。 */
export function tabelogPost(review: Review): TabelogPost {
  return {
    id: review.id, kind: "review", source: "tabelog", externalId: review.id, sourceUrl: review.detailUrl,
    title: review.title, body: review.body,
    date: { value: review.reviewDate, precision: "month", label: "visited" },
    review: { name: review.name, url: review.url, rating: review.rating, likeCount: review.likeCount },
  };
}

/** 手入力の公開条件を検証し、食べログのIDと衝突しないCMS由来の識別子を付ける。 */
export function entryPost(id: string, input: Record<string, unknown>): Post {
  const data = entryDataSchema.parse(input);
  const common = {
    id: `manual-${z.string().min(1).parse(id)}`, source: "manual" as const, externalId: null, sourceUrl: null,
    title: data.title || null, body: data.body,
  };
  if (data.kind === "review") return {
    ...common, kind: "review", date: { value: data.review_month!, precision: "month", label: "visited" },
    review: { name: data.restaurant_name!, url: data.restaurant_url || null, rating: data.rating!, likeCount: null },
  };
  return { ...common, kind: data.kind, date: { value: new Date(data.written_at).toISOString(), precision: "datetime", label: "written" }, review: null };
}

/** 月だけの口コミは同月の日時付き投稿の後に置き、同順位はIDで固定する。 */
export function comparePosts(a: Post, b: Post): number {
  const monthOf = (post: Post) => post.date.precision === "month" ? post.date.value
    : new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date(post.date.value));
  const monthOrder = monthOf(b).localeCompare(monthOf(a));
  if (monthOrder) return monthOrder;
  if (a.date.precision !== b.date.precision) return a.date.precision === "month" ? 1 : -1;
  return b.date.value.localeCompare(a.date.value) || a.id.localeCompare(b.id);
}
