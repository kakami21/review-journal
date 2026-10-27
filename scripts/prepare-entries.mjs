import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { createCmsClient } from "./migrate-reviews.mjs";

/** 既存のreviewsには触れず、手入力用コレクションと不足している項目だけを追加する。 */
export async function prepareEntries(api, definition) {
  const { fields, titleField, ...collection } = definition;
  const list = await api("schema/collections");
  if (!list.items.some(item => item.slug === "entries")) {
    await api("schema/collections", "POST", collection);
  }
  const existing = await api("schema/collections/entries/fields");
  for (const field of fields) {
    const found = existing.items.find(item => item.slug === field.slug);
    if (found) {
      // 既存項目が別用途なら、型や制約を黙って変更せずに停止する。
      if (found.type !== field.type || found.required !== Boolean(field.required)
        || !isDeepStrictEqual(found.validation ?? null, field.validation ?? null)) {
        throw new Error(`entries.${field.slug}の定義が異なります。既存のデータを確認してください。`);
      }
      continue;
    }
    await api("schema/collections/entries/fields", "POST", field);
  }
  await api("schema/collections/entries", "PUT", {
    label: collection.label, labelSingular: collection.labelSingular, titleField,
    supports: collection.supports, routable: collection.routable, urlPattern: collection.urlPattern,
  });
}

if (import.meta.main) {
  const [origin] = process.argv.slice(2);
  if (!origin) throw new Error("接続先オリジンを指定してください。");
  const seed = JSON.parse(await readFile(new URL("../astro/seed/seed.json", import.meta.url), "utf8"));
  await prepareEntries(createCmsClient(origin, process.env.EMDASH_API_TOKEN), seed.collections.find(item => item.slug === "entries"));
  console.log("手入力投稿の保存先を準備しました。既存口コミは変更していません。");
}
