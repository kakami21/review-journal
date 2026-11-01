import { ContentSaveRejectedError, definePlugin } from "emdash";

/** 口コミの取得元情報を固定し、手入力投稿は種類に応じた保存条件を検証する。 */
export function createPlugin() {
  return definePlugin({
    id: "review-source-policy",
    version: "1.0.0",
    capabilities: ["content:write"],
    hooks: {
      "content:beforeSave": async (event, ctx) => {
        if (event.collection === "entries") {
          const original = event.isNew ? null : await ctx.content.get("entries", event.id);
          const data = { ...original?.data, ...event.content };
          if (!["review", "note", "article"].includes(data.kind)) throw new ContentSaveRejectedError("種類を選択してください。");
          if (data.kind === "review" && (!String(data.restaurant_name ?? "").trim()
            || !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(data.review_month ?? ""))
            || typeof data.rating !== "number" || !Number.isFinite(data.rating) || data.rating < 0 || data.rating > 5)) {
            throw new ContentSaveRejectedError("口コミには店舗名・訪問年月（YYYY-MM）・0〜5の評価が必要です。");
          }
          return;
        }
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
