import { useRef, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { apiFetch } from "emdash/plugin-utils";
import type { ReviewImportResult } from "./import-reviews";

/** 画面内の二重送信を防ぎ、収集・保存の結果を公開操作と分けて表示する。 */
function ReviewImportPage() {
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReviewImportResult | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  async function runImport() {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setResult(null);
    setConnectionError(false);
    try {
      const response = await apiFetch("/_emdash/api/plugins/review-import/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) throw new Error("取り込み結果を確認できませんでした。");
      const body = await response.json() as { success: boolean; data: ReviewImportResult };
      if (!body.success) throw new Error("取り込み結果を確認できませんでした。");
      setResult(body.data);
    } catch {
      setConnectionError(true);
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  return <section className="flex max-w-2xl flex-col gap-4" aria-busy={pending}>
    <h1 className="text-2xl font-semibold">口コミの取り込み</h1>
    <p>食べログから新しい口コミを下書きとして追加します。登録済みの口コミや編集内容は変更しません。</p>
    <Button variant="primary" disabled={pending} loading={pending} onClick={runImport}>
      {pending ? "取り込み中…" : "口コミを取り込む"}
    </Button>
    <div role="status" aria-live="polite">
      {pending && <p>口コミを取り込んでいます。この画面を開いたままお待ちください。</p>}
      {result?.ok && <div className="flex flex-col gap-2">
        <p>取り込みが完了しました。{result.addedCount === 0 && "新しい口コミはありませんでした。"}</p>
        <dl className="grid grid-cols-2 gap-2">
          <dt>取得件数</dt><dd>{result.count}件</dd>
          <dt>新規追加件数</dt><dd>{result.addedCount}件</dd>
          <dt>成功日時</dt><dd>{new Date(result.scrapedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）</dd>
        </dl>
      </div>}
    </div>
    {(connectionError || result?.ok === false) && <p role="alert" className="text-kumo-danger">
      {connectionError
        ? "通信または認証の問題で結果を確認できませんでした。取り込みが進んでいる可能性があります。しばらく待って口コミ一覧を確認し、必要ならログインし直して再実行してください。"
        : result?.ok === false && result.stage === "collection"
          ? "口コミの取得に失敗しました。保存は開始していません。時間をおいて再実行してください。"
          : "口コミの保存に失敗しました。一部の下書きは追加済みの可能性があります。時間をおいて再実行すると、登録済みの口コミを除いて取り込みます。"}
    </p>}
    <p>追加された下書きは「口コミ」一覧で確認し、編集・公開してください。</p>
    <a href="/_emdash/admin/content/reviews" className="text-kumo-link underline">口コミ一覧を開く</a>
  </section>;
}

export const pages = { "/import": ReviewImportPage };
