/** CMS本文から独立したD1テーブルで、最後に保存まで成功した収集日時だけを管理する。 */
export class ReviewSyncStore {
  constructor(private readonly db: D1Database) {}

  /** 遅れて完了した取り込みでも成功日時を過去へ戻さない。 */
  async recordSuccess(scrapedAt: string) {
    await this.db.prepare(`
      INSERT INTO app_review_sync (id, last_updated_at) VALUES (1, ?1)
      ON CONFLICT(id) DO UPDATE SET last_updated_at = MAX(last_updated_at, excluded.last_updated_at)
    `).bind(scrapedAt).run();
  }

  async getLastUpdatedAt() {
    const row = await this.db.prepare("SELECT last_updated_at FROM app_review_sync WHERE id = 1")
      .first<{ last_updated_at: string }>();
    return row?.last_updated_at ?? null;
  }
}
