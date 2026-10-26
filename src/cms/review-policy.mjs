import { ContentSaveRejectedError, definePlugin } from "emdash";

/** 取得元との対応を固定し、本文の編集によって次回の取り込み対象が変わることを防ぐ。 */
export function createPlugin() {
  return definePlugin({
    id: "review-source-policy",
    version: "1.0.0",
    capabilities: ["content:write"],
    hooks: {
      "content:beforeSave": async (event, ctx) => {
        if (event.collection !== "reviews" || event.isNew) return;
        const original = await ctx.content.get("reviews", event.id);
        if (!original) throw new ContentSaveRejectedError("元の口コミを確認できませんでした。");
        for (const field of ["source_id", "source_url", "imported_at"]) {
          if (field in event.content && event.content[field] !== original.data[field]) {
            throw new ContentSaveRejectedError("食べログID・URL・初回取り込み日時は変更できません。");
          }
        }
      },
    },
  });
}
