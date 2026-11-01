import { z } from "zod";

export const postLikeStateSchema = z.object({ likeCount: z.number().int().nonnegative(), liked: z.boolean() });
export type PostLikeState = { likeCount: number; liked: boolean };
export interface PostLikeStore {
  read(keys: string[], visitorId: string | null): Promise<Map<string, PostLikeState>>;
  set(key: string, visitorId: string, liked: boolean): Promise<PostLikeState>;
}

/** 表示用スラッグを使わず、CMSの保存先と不変のコンテンツIDを組み合わせる。 */
export function postLikeKey(collection: "reviews" | "entries", contentId: string): string {
  if (!contentId) throw new Error("投稿のコンテンツIDが必要です。");
  return `${collection}:${contentId}`;
}
