import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { reviewData, publicReview } from "../src/cms/review-data.ts";

const reviewSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), url: z.url(), detailUrl: z.url(),
  title: z.string().nullable(), body: z.string().nullable(),
  reviewDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  rating: z.number().min(0).max(5), likeCount: z.number().int().nonnegative(),
});
const snapshotSchema = z.object({ reviews: z.array(reviewSchema).min(1), lastUpdatedAt: z.iso.datetime() })
  .refine((s) => new Set(s.reviews.map((r) => r.id)).size === s.reviews.length, "口コミIDが重複しています。");

export const parseSnapshot = (value) => snapshotSchema.parse(value);
const sorted = (reviews) => [...reviews].sort((a, b) => a.id.localeCompare(b.id));

/** 一般向けAPIと照合し、本文・ID・件数を含む公開内容の不一致を移行成功にしない。 */
export function verifyPublic(snapshot, actual, includeDate = true) {
  const reviews = z.array(reviewSchema).parse(actual.reviews);
  if (!isDeepStrictEqual(sorted(snapshot.reviews), sorted(reviews))
    || (includeDate && snapshot.lastUpdatedAt !== actual.lastUpdatedAt)) {
    throw new Error("移行元と公開データの内容・件数・最終取得日時が一致しません。");
  }
}

/** 自前の収集日時テーブルだけを更新するSQL。CMS内部テーブルは変更しない。 */
export function metadataSql(snapshot) {
  const { lastUpdatedAt } = parseSnapshot(snapshot);
  return `INSERT INTO app_review_sync (id, last_updated_at) VALUES (1, '${lastUpdatedAt}')\nON CONFLICT(id) DO UPDATE SET last_updated_at = excluded.last_updated_at;\n`;
}

/** HTTPSの指定先だけへBearerを送り、リダイレクト先への認証情報の転送を拒否する。 */
export function createCmsClient(origin, token, fetcher = fetch) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("接続先は認証情報を含まないHTTPSオリジンで指定してください。");
  }
  return async (path, method = "GET", body) => {
    if (!token) throw new Error("EMDASH_API_TOKENが必要です。");
    const response = await fetcher(new URL(`/_emdash/api/${path}`, url), {
      method, redirect: "error", signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(`CMS処理に失敗しました: ${response.status} ${result.error?.code ?? "UNKNOWN"}`);
    return result.data;
  };
}

/** 保守中の一度限りの初期移行。既存の編集・ゴミ箱・不一致を上書きせず停止する。 */
export async function migrateReviews(input, api) {
  const snapshot = parseSnapshot(input);
  const existing = new Map();
  for (const trashed of [false, true]) {
    let cursor;
    do {
      const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
      const page = await api(`content/reviews${trashed ? "/trash" : ""}?${query}`);
      for (const item of page.items) {
        const sourceId = item.data.source_id;
        if (existing.has(sourceId)) throw new Error("CMSの取得元IDが重複しています。");
        existing.set(sourceId, { ...item, trashed });
      }
      cursor = page.nextCursor;
    } while (cursor);
  }
  // 既知の不一致は、1件も書き込む前に検出する。
  for (const review of snapshot.reviews) {
    const item = existing.get(review.id);
    if (item && (item.trashed || !isDeepStrictEqual(review, publicReview(item.data)))) {
      throw new Error(`既存の編集内容またはゴミ箱と競合しています: ${review.id}`);
    }
  }
  let created = 0;
  let published = 0;
  for (const review of snapshot.reviews) {
    let item = existing.get(review.id);
    if (!item) {
      const result = await api("content/reviews", "POST", {
        slug: review.id, status: "draft", data: reviewData(review, snapshot.lastUpdatedAt),
      });
      item = result.item;
      created++;
    }
    if (item.status !== "published") {
      const current = await api(`content/reviews/${encodeURIComponent(item.id)}`);
      if (!isDeepStrictEqual(review, publicReview(current.item.data))) throw new Error("移行中に口コミが変更されました。");
      await api(`content/reviews/${encodeURIComponent(item.id)}/publish`, "POST", { _rev: current._rev });
      published++;
    }
  }
  return { count: snapshot.reviews.length, created, published };
}

if (import.meta.main) {
  const [command, file, origin, sqlFile] = process.argv.slice(2);
  if (command === "snapshot") {
    const response = await fetch("https://pakoirileo.nokishita.app/api/reviews", { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`移行元の取得に失敗しました: ${response.status}`);
    const snapshot = parseSnapshot(await response.json());
    await writeFile(file, JSON.stringify(snapshot, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ count: snapshot.reviews.length, lastUpdatedAt: snapshot.lastUpdatedAt }));
  } else if (command === "import" || command === "verify") {
    const snapshot = parseSnapshot(JSON.parse(await readFile(file, "utf8")));
    if (command === "import") {
      if (!sqlFile || resolve(file) === resolve(sqlFile)) throw new Error("移行元と異なる日時SQLの出力先が必要です。");
      const result = await migrateReviews(snapshot, createCmsClient(origin, process.env.EMDASH_API_TOKEN));
      const response = await fetch(new URL("/api/reviews", origin), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("公開データを取得できませんでした。");
      verifyPublic(snapshot, await response.json(), false);
      await writeFile(sqlFile, metadataSql(snapshot), { mode: 0o600 });
      console.log(JSON.stringify({ ...result, metadataSql: sqlFile }));
    } else {
      const response = await fetch(new URL("/api/reviews", origin), { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error("公開データを取得できませんでした。");
      verifyPublic(snapshot, await response.json());
      console.log("口コミ全項目・件数・最終取得日時が一致しました。");
    }
  } else {
    throw new Error("snapshot <json> / import <json> <origin> <日時sql> / verify <json> <origin> を指定してください。");
  }
}
