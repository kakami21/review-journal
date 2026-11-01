import { readFile } from "node:fs/promises";
import { createCmsClient } from "./migrate-reviews.mjs";

/** 認証付きCMSスキーマAPIで追加だけ行い、既存フィールドや投稿を変更しない。途中失敗後も再実行できる。 */
export async function setupEntries(api, definition) {
  const existing = await api("schema/collections");
  if (!existing.items.some(item => item.slug === definition.slug)) {
    const { fields, titleField, ...collection } = definition;
    await api("schema/collections", "POST", collection);
  }
  const result = await api(`schema/collections/${definition.slug}/fields`);
  for (const field of definition.fields) {
    const current = result.items.find(item => item.slug === field.slug);
    if (current) {
      if (current.type !== field.type || Boolean(current.required) !== Boolean(field.required)
        || JSON.stringify(current.validation ?? null) !== JSON.stringify(field.validation ?? null)) {
        throw new Error(`既存フィールド ${field.slug} が定義と異なります。手動で確認してください。`);
      }
      continue;
    }
    await api(`schema/collections/${definition.slug}/fields`, "POST", { ...field, validation: field.validation ?? null });
  }
  await api(`schema/collections/${definition.slug}`, "PUT", { titleField: definition.titleField });
  return { collection: definition.slug, fields: definition.fields.length };
}

if (import.meta.main) {
  const seed = JSON.parse(await readFile(new URL("../seed/seed.json", import.meta.url), "utf8"));
  const api = createCmsClient(process.argv[2], process.env.EMDASH_API_TOKEN);
  console.log(JSON.stringify(await setupEntries(api, seed.collections.find(collection => collection.slug === "entries"))));
}
