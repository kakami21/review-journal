import { getEmDashCollection } from "emdash";
import { entryPost, tabelogPost } from "../posts/post";
import type { PostContent } from "../posts/post";
import { postLikeKey } from "../posts/post-likes";
import { publicReview } from "./review-data";

export type PublicPostRecord = { post: PostContent; likeKey: string };

/** 公開版だけを全ページ読み、表示用IDとCMSの不変IDとの対応をサーバー内に保持する。 */
export async function readPublicPostCatalog(): Promise<PublicPostRecord[]> {
  const records: PublicPostRecord[] = [];
  for (const collection of ["reviews", "entries"] as const) {
    let cursor: string | undefined;
    do {
      const result = await getEmDashCollection(collection, { limit: 100, cursor, status: "published" });
      if (result.error) throw result.error;
      for (const entry of result.entries) {
        const contentId = entry.data.id;
        if (typeof contentId !== "string" || !contentId) throw new Error("公開投稿のCMS IDがありません。");
        records.push({
          post: collection === "reviews" ? tabelogPost(publicReview(entry.data)) : entryPost(contentId, entry.data),
          likeKey: postLikeKey(collection, contentId),
        });
      }
      cursor = result.nextCursor;
    } while (cursor);
  }
  return records;
}
