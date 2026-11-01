import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReviewListPage } from "../src/react-app/pages/ReviewListPage";

describe("口コミ一覧の初回HTML", () => {
  it("背景・見出し・取得中の案内を表示し、未取得を0件や未実行と表示しない", () => {
    const html = renderToStaticMarkup(createElement(ReviewListPage));
    expect(html).toContain("bg-amber-50");
    expect(html).toContain("箱入レオのルーザー日記");
    expect(html).toContain('role="status"');
    expect(html).toContain("口コミを読み込んでいます");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("0件の口コミ");
    expect(html).not.toContain("未実行");
    expect(html).not.toContain('role="alert"');
  });
});
