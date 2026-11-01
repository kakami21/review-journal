import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ReviewSyncStore } from "../src/lib/cms/review-sync-store";

it("成功日時をD1互換SQLで保存し、遅い取り込みが後から完了しても日時を戻さない", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../migrations/emdash/0001_review_sync.sql", import.meta.url), "utf8"));
  const db = { prepare: (sql: string) => ({
    first: async () => sqlite.prepare(sql).get(),
    bind: (...values: string[]) => ({ run: async () => sqlite.prepare(sql).run(...values) }),
  }) } as unknown as D1Database;
  const store = new ReviewSyncStore(db);
  try {
    expect(await store.getLastUpdatedAt()).toBeNull();
    await store.recordSuccess("2026-11-01T02:00:00.000Z");
    await store.recordSuccess("2026-11-01T01:00:00.000Z");
    expect(await store.getLastUpdatedAt()).toBe("2026-11-01T02:00:00.000Z");
  } finally { sqlite.close(); }
});
