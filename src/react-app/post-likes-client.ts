import type { PostLikeState } from "../posts/post-likes";
import { postLikeStateSchema } from "../posts/post-likes";
import { z } from "zod";

async function result<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  if (!response.ok) throw new Error(response.status === 429 ? "しばらく待ってから操作してください。" : "いいねの操作に失敗しました。");
  return schema.parse(await response.json());
}

/** 閲覧者Cookieの初回発行を全タブで直列化し、Cookieが戻らなければ票を送信しない。 */
export async function confirmLikeVisitor(): Promise<void> {
  if (!navigator.locks) throw new Error("このブラウザではいいねを利用できません。");
  await navigator.locks.request("post-like-visitor", async () => {
    const confirm = () => fetch("/api/like-visitor", { method: "POST", headers: { "X-Post-Likes": "1" } })
      .then(response => result(response, z.object({ confirmed: z.boolean() })));
    if ((await confirm()).confirmed) return;
    if (!(await confirm()).confirmed) throw new Error("いいねにはCookieを許可してください。");
  });
}

/** 閲覧者の状態は共有キャッシュを使わず、100件ずつまとめて取得する。 */
export async function loadLikeStates(ids: string[], signal?: AbortSignal): Promise<Record<string, PostLikeState>> {
  const states: Record<string, PostLikeState> = {};
  for (let offset = 0; offset < ids.length; offset += 100) {
    const query = new URLSearchParams({ ids: ids.slice(offset, offset + 100).join(",") });
    const response = await fetch(`/api/post-likes?${query}`, { cache: "no-store", signal });
    const loaded = (await result(response, z.object({ states: z.record(z.string(), postLikeStateSchema) }))).states;
    if (ids.slice(offset, offset + 100).some(id => !Object.hasOwn(loaded, id))) throw new Error("いいねの状態が不足しています。");
    Object.assign(states, loaded);
  }
  return states;
}

/** サーバーの成功応答だけで件数を確定する。反転APIを使わないため再送でも票は増えない。 */
export async function updatePostLike(id: string, liked: boolean): Promise<PostLikeState> {
  await confirmLikeVisitor();
  return result(await fetch(`/api/post-likes/${encodeURIComponent(id)}`, {
    method: liked ? "PUT" : "DELETE", headers: { "X-Post-Likes": "1" },
  }), postLikeStateSchema);
}
