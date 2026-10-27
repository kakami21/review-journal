import { ContentSaveRejectedError, definePlugin } from "emdash";
import { entryPost } from "../posts/post";

/** 未完成の下書きは保存できるが、種類別の条件を満たさない公開・予約は拒否する。 */
export function createPlugin() {
  const validate = async (event: { collection: string; content: Record<string, unknown> }) => {
    if (event.collection !== "entries") return;
    try { entryPost("validation", event.content.data as Record<string, unknown>); }
    catch { return { cancel: true as const, reason: "本文・投稿日時を確認してください。口コミには店舗名・訪問年月・0〜5の評価、記事にはタイトルが必要です。" }; }
  };
  return definePlugin({
    id: "entry-policy", version: "1.0.0",
    capabilities: ["content:write", "hooks.content-policy:register"],
    hooks: {
      "content:beforeSave": async (event) => {
        if (event.collection !== "entries") return;
        if ("source" in event.content && event.content.source !== "manual") {
          throw new ContentSaveRejectedError("手入力投稿の取得元はmanualです。");
        }
        // 作成時だけ初期値を設定し、更新では既存の種類・投稿日時を保持する。
        if (event.isNew) return {
          ...event.content, source: "manual", kind: event.content.kind ?? "note",
          written_at: event.content.written_at ?? new Date().toISOString(),
        };
      },
      "content:beforePublish": validate,
      "content:beforeSchedule": validate,
    },
  });
}
