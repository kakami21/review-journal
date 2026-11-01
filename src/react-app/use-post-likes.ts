import { useEffect, useRef, useState } from "react";
import type { Post } from "../posts/post";
import type { PostLikeState } from "../posts/post-likes";
import { loadLikeStates, updatePostLike } from "./post-likes-client";

/** 公開本文と独立して本人の状態を読み、更新前の取得結果で成功状態を巻き戻さない。 */
export function usePostLikes(posts: Post[] | undefined) {
  const [states, setStates] = useState<Record<string, PostLikeState>>({});
  const [pending, setPending] = useState(new Set<string>());
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const active = useRef(new Set<string>());
  const version = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const refresh = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (!posts) return;
    const controller = new AbortController();
    // 他タブの更新も再取得し、本人の状態をメッセージ本文へ載せない。
    const broadcast = new BroadcastChannel("post-likes");
    channel.current = broadcast;
    const load = async () => {
      const started = ++version.current;
      try {
        const loaded = await loadLikeStates(posts.map(post => post.id), controller.signal);
        if (controller.signal.aborted || started !== version.current || active.current.size) return;
        setStates(loaded);
        setLoadError("");
      } catch {
        if (!controller.signal.aborted && started === version.current) setLoadError("いいねの状態を取得できません。再読み込みしてください。");
      }
    };
    refresh.current = load;
    const focused = () => { void load(); };
    broadcast.onmessage = focused;
    window.addEventListener("focus", focused);
    void load();
    return () => {
      controller.abort();
      broadcast.close();
      channel.current = null;
      window.removeEventListener("focus", focused);
    };
  }, [posts]);

  /** 送信中の連打を抑え、サーバーで確定した件数だけを表示する。 */
  async function like(id: string) {
    if (active.current.has(id) || !states[id]) return;
    active.current.add(id);
    version.current++;
    setPending(current => new Set(current).add(id));
    setError("");
    try {
      const updated = await updatePostLike(id, !states[id].liked);
      setStates(current => ({ ...current, [id]: updated }));
      channel.current?.postMessage("updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "いいねの操作に失敗しました。");
    } finally {
      active.current.delete(id);
      version.current++;
      setPending(current => { const next = new Set(current); next.delete(id); return next; });
      // 更新中に届いた他タブの通知も、最後の保存後にまとめて反映する。
      if (!active.current.size) void refresh.current();
    }
  }
  return { states, pending, error: error || loadError, like };
}
