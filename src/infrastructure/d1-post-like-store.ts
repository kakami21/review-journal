import type { PostLikeState, PostLikeStore } from "../posts/post-likes";

/** 件数を別カウンターへ複製せず、票の一意制約と集計だけで扱う。 */
export class D1PostLikeStore implements PostLikeStore {
  constructor(private readonly db: D1Database) {}

  async read(keys: string[], visitorId: string | null): Promise<Map<string, PostLikeState>> {
    if (keys.length === 0) return new Map();
    // json_eachで対象を1つのパラメーターにし、一覧の件数が増えてもバインド上限に触れない。
    const result = await this.db.prepare(`
      SELECT requested.value AS post_key, COUNT(vote.visitor_id) AS like_count,
             COALESCE(MAX(vote.visitor_id = ?2), 0) AS liked
      FROM json_each(?1) AS requested
      LEFT JOIN post_likes AS vote ON vote.post_key = requested.value
      GROUP BY requested.value
    `).bind(JSON.stringify([...new Set(keys)]), visitorId).all<{ post_key: string; like_count: number; liked: number }>();
    if (!result.success) throw new Error("いいねの集計に失敗しました。");
    return new Map(result.results.map(row => [row.post_key, { likeCount: row.like_count, liked: row.liked === 1 }]));
  }

  /** PUT相当は同じ票だけを無視し、DELETE相当は本人の票だけを削除する。 */
  async set(key: string, visitorId: string, liked: boolean): Promise<PostLikeState> {
    const result = liked
      ? await this.db.prepare(`INSERT INTO post_likes (post_key, visitor_id) VALUES (?1, ?2)
          ON CONFLICT(post_key, visitor_id) DO NOTHING`).bind(key, visitorId).run()
      : await this.db.prepare("DELETE FROM post_likes WHERE post_key = ?1 AND visitor_id = ?2").bind(key, visitorId).run();
    if (!result.success) throw new Error("いいねの保存に失敗しました。");
    return (await this.read([key], visitorId)).get(key)!;
  }
}
