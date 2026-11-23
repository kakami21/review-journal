import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

// 本番用バンドルに含まれる編集開始処理を実行し、依存更新で空欄の修正が消えた場合も検出する。
const bundle = readFileSync(new URL("../node_modules/emdash/dist/astro/middleware/request-context.mjs", import.meta.url), "utf8");
const source = bundle.match(/function startTextEditIfShownAsStored\(element, annotation, caret\) \{[\s\S]*?\n  \}/)![0];

it.each([null, undefined, "", "本文\n2行目"])("保存値が%sでも、その場で本文を編集できる", async stored => {
  const startTextEdit = vi.fn(), openAdmin = vi.fn();
  const ecFetch = vi.fn(async () => ({ json: async () => ({ data: { item: { data: { body: stored } } } }) }));
  const start = new Function("ecFetch", "startTextEdit", "openAdmin", `${source}; return startTextEditIfShownAsStored;`)(ecFetch, startTextEdit, openAdmin);
  const element = { children: [], textContent: stored ?? "" };
  const annotation = { collection: "reviews", id: "cms-id", field: "body" };
  start(element, annotation, null);
  await vi.waitFor(() => expect(startTextEdit).toHaveBeenCalledWith(element, annotation, null, true));
  expect(openAdmin).not.toHaveBeenCalled();
});

it("本文の取得に失敗した場合は、空の保存値とみなして上書きしない", async () => {
  const startTextEdit = vi.fn(), openAdmin = vi.fn();
  const ecFetch = vi.fn(async () => ({ json: async () => ({ error: { code: "NOT_FOUND" } }) }));
  const start = new Function("ecFetch", "startTextEdit", "openAdmin", `${source}; return startTextEditIfShownAsStored;`)(ecFetch, startTextEdit, openAdmin);
  const annotation = { collection: "reviews", id: "missing", field: "body" };
  start({ children: [], textContent: "" }, annotation, null);
  await vi.waitFor(() => expect(openAdmin).toHaveBeenCalledWith(annotation));
  expect(startTextEdit).not.toHaveBeenCalled();
});
