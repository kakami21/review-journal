import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReviewListPage } from "../src/components/ReviewListPage";


const review = { id: "tabelog-1", detailUrl: "https://tabelog.com/rvwdtl/1/", name: "店舗", url: "https://tabelog.com/restaurant/1/", title: "公開タイトル", body: "公開本文", reviewDate: "2026-10", rating: 4, likeCount: 3 };

describe("口コミ一覧の初回HTML", () => {
  it("追加通信なしで公開本文・既存リンク・訪問年月・日本時間を表示する", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      const html = renderToStaticMarkup(createElement(ReviewListPage, { data: { reviews: [review], lastUpdatedAt: "2026-10-31T15:05:00Z" } }));
      expect(html).toContain("bg-amber-50");
      expect(html).toContain("箱入レオのルーザー日記");
      expect(html).toContain("公開本文");
      expect(html).toContain('id="tabelog-1"');
      expect(html).toContain(`href="${review.url}"`);
      expect(html).toContain("2026/10");
      expect(html).toContain("2026/11/01 0:05");
      expect(html).not.toContain('role="status"');
      expect(html).not.toContain('disabled=""');
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it("訪問年月の降順を初回表示し、評価順への切替ボタンを保つ", () => {
    const html = renderToStaticMarkup(createElement(ReviewListPage, { data: { reviews: [{ ...review, id: "old", body: "古い本文", reviewDate: "2026-09", rating: 5 }, review], lastUpdatedAt: null } }));
    expect(html.indexOf("公開本文")).toBeLessThan(html.indexOf("古い本文"));
    expect(html).toContain('aria-pressed="true">訪問年月順');
    expect(html).toContain('aria-pressed="false">評価順');
  });

  it("正常な0件は0件と未実行を表示する", () => {
    const html = renderToStaticMarkup(createElement(ReviewListPage, { data: { reviews: [], lastUpdatedAt: null } }));
    expect(html).toContain("0件の口コミ");
    expect(html).toContain("未実行");
    expect(html).not.toContain('role="alert"');
  });

  it("取得失敗は背景と案内を保ち、0件や未実行と表示しない", () => {
    const html = renderToStaticMarkup(createElement(ReviewListPage, { errorMessage: "口コミの取得に失敗しました。時間をおいて再度お試しください。" }));
    expect(html).toContain("bg-amber-50");
    expect(html).toContain('role="alert"');
    expect(html).toContain("口コミの取得に失敗しました");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("0件の口コミ");
    expect(html).not.toContain("未実行");
  });
});
