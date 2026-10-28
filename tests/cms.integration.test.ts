import assert from "node:assert/strict";
import { test } from "vitest";
import { TabelogReviewStore } from "../src/cms/tabelog-review-store";

test("実CMSで公開状態を保ちながら新規口コミだけを取り込む", async () => {
  const port = Number(process.env.CMS_TEST_PORT ?? 4321);
  assert(Number.isInteger(port) && port > 0 && port < 65536, "ローカルのポート番号を指定してください。");
  const base = `http://127.0.0.1:${port}`;
  // 公式の開発専用セットアップをローカルでだけ利用する。本番ではこのエンドポイントは403となる。
  const setup = await fetch(`${base}/_emdash/api/setup/dev-bypass?content=0&token=1`, { method: "POST" });
  assert(setup.ok, "先にnpm run devを起動してください。");
  const token = ((await setup.json()) as any).data?.token;
  assert(token, "開発用の認証トークンを取得できませんでした。");
  async function api(path: string, method = "GET", body?: unknown) {
    const response = await fetch(`${base}/_emdash/api/${path}`, {
      method, headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response.json() as Promise<any>;
  }
  const query = (parameters: Record<string, unknown>) => new URLSearchParams(Object.entries(parameters)
    .filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  let lastDate: string | undefined;
  const db = { prepare: () => ({ bind: (date: string) => ({ run: async () => { lastDate = date; } }) }) };
  const cms = {
    handleContentCreate: (collection: string, body: unknown) => api(`content/${collection}`, "POST", body),
    handleContentList: (collection: string, parameters: Record<string, unknown>) =>
      api(`content/${collection}?${query(parameters)}`),
    handleContentListTrashed: (collection: string, parameters: Record<string, unknown>) =>
      api(`content/${collection}/trash?${query(parameters)}`),
  };
  const store = new TabelogReviewStore(cms as never, db as never);
  const sourceId = `integration-${Date.now()}`;
  const review = {
    id: sourceId, detailUrl: `https://tabelog.com/rvwr/test/${sourceId}`, name: "結合テスト店舗",
    url: "https://tabelog.com/restaurant/test", title: null, body: "取得原文\n2行目",
    reviewDate: "2026-10", rating: 4, likeCount: 3,
  };
  // 同じ取得元IDを同時に取り込み、DBの一意制約と競合後の照合を実CMSで確認する。
  const concurrent = await Promise.all([store.importNew([review], "2026-10-26T00:00:00.000Z"), store.importNew([review], "2026-10-26T00:00:00.000Z")]);
  assert.equal(concurrent.reduce((sum, result) => sum + result.addedCount, 0), 1);
  assert.equal(lastDate, "2026-10-26T00:00:00.000Z");
  const list = await api("content/reviews");
  const item = list.data.items.find((candidate: any) => candidate.data.source_id === sourceId);
  assert(item);
  assert.equal(item.status, "draft");
  async function publicList() {
    const response = await fetch(`${base}/api/reviews`);
    assert.equal(response.status, 200);
    return ((await response.json()) as any).reviews;
  }
  assert(!(await publicList()).some((candidate: any) => candidate.id === sourceId));
  let published = await api(`content/reviews/${item.id}/publish`, "POST", {});
  assert(published.success, JSON.stringify(published));
  assert.equal((await publicList()).find((candidate: any) => candidate.id === sourceId).body, review.body);
  const updated = await api(`content/reviews/${item.id}`, "PUT", { data: { body: "管理画面で編集した本文" } });
  assert(updated.success, JSON.stringify(updated));
  assert.equal((await publicList()).find((candidate: any) => candidate.id === sourceId).body, review.body, "編集中の下書きを公開しない");
  published = await api(`content/reviews/${item.id}/publish`, "POST", {});
  assert(published.success, JSON.stringify(published));
  assert.equal((await publicList()).find((candidate: any) => candidate.id === sourceId).body, "管理画面で編集した本文");
  assert.equal((await store.importNew([review], "2026-10-26T01:00:00.000Z")).addedCount, 0);
  assert.equal((await publicList()).find((candidate: any) => candidate.id === sourceId).body, "管理画面で編集した本文");
  const rejected = await api(`content/reviews/${item.id}`, "PUT", { data: { source_id: "modified-id" } });
  assert.equal(rejected.success, false, JSON.stringify(rejected));
  const removed = await api(`content/reviews/${item.id}`, "DELETE");
  assert(removed.success, JSON.stringify(removed));
  assert.equal((await store.importNew([review], "2026-10-26T02:00:00.000Z")).addedCount, 0);
  assert(!(await publicList()).some((candidate: any) => candidate.id === sourceId));
}, 30_000);
