import { z } from "zod";

const photoSchema = z.object({
  id: z.string(),
  alt: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  src: z.url({ protocol: /^https?$/ }).optional(),
  meta: z.object({ storageKey: z.string().min(1).optional() }).optional(),
}).refine(photo => Boolean(photo.meta?.storageKey || photo.src), "写真の保存先がありません。");

export type PostPhoto = { url: string; alt: string; width?: number; height?: number };

/** 公開版の画像参照を標準メディア配信URLへ変換する。不正な画像参照は取得失敗として扱う。 */
export function publicPhoto(input: unknown): PostPhoto | null {
  if (input == null) return null;
  const photo = photoSchema.parse(input);
  return {
    url: photo.meta?.storageKey
      ? `/_emdash/api/media/file/${photo.meta.storageKey.split("/").map(encodeURIComponent).join("/")}`
      : photo.src!,
    alt: photo.alt ?? "",
    width: photo.width,
    height: photo.height,
  };
}
