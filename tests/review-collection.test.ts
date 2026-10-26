import { afterEach, describe, expect, it, vi } from "vitest";
import { TabelogReviewScraper, type ScrapingLocator, type ScrapingPage } from "../src/reviews/tabelog-review-scraper";
import { importCollectedReviews } from "../src/reviews/import-collected-reviews";
import { CmsReviewStore } from "../src/cms/review-store";

type Element = { text?: string; attributes?: Record<string, string>; children?: Record<string, Element[]> };

// ページごとの要素を固定し、実ブラウザーを使わず一覧巡回と抽出の契約を検証する。
function locator(elements: Element[]): ScrapingLocator {
  return {
    count: async () => elements.length,
    first: () => locator(elements.slice(0, 1)),
    nth: (index) => locator(elements.slice(index, index + 1)),
    locator: (selector) => locator(elements.flatMap((element) => element.children?.[selector] ?? [])),
    innerText: async () => {
      if (elements.length !== 1) throw new Error("要素が一意ではありません。");
      return elements[0].text ?? "";
    },
    getAttribute: async (name) => {
      if (elements.length !== 1) throw new Error("要素が一意ではありません。");
      return elements[0].attributes?.[name] ?? null;
    },
  };
}

const startUrl = "https://tabelog.com/rvwr/test/reviewed_restaurants/list";
const secondUrl = `${startUrl}?page=2`;
const detailUrl = (id: string) => `https://tabelog.com/rvwr/test/rvwdtl/${id}/`;
const item = (id: string): Element => ({
  attributes: { "data-detail-url": detailUrl(id) },
  children: { "a.rvw-item__rst-name": [{ text: " 店舗  名 ", attributes: { href: "/restaurant/1/" } }] },
});
const detail = (): Record<string, Element[]> => ({
  ".rvw-item__ratings--val": [{ text: "4.0" }],
  ".rvw-item__date": [{ text: "2026/10 訪問" }],
  ".rvw-item__vote-like .js-like-btn-count > span": [{ text: "3" }],
});

function fixture(pages: Record<string, Record<string, Element[]>>, failedUrl?: string) {
  const visited: string[] = [];
  const newPage = async (): Promise<ScrapingPage> => {
    let currentUrl = "";
    return {
      goto: async (url) => {
        visited.push(url);
        currentUrl = url;
        return { ok: () => url !== failedUrl, status: () => url === failedUrl ? 503 : 200 };
      },
      locator: (selector) => locator(pages[currentUrl]?.[selector] ?? []),
      waitForTimeout: async () => {},
    };
  };
  const close = vi.fn();
  const scraper = new TabelogReviewScraper({ open: async () => ({ newPage, close }) }, "test");
  return { scraper, close, visited };
}

function cmsStore() {
  const create = vi.fn().mockResolvedValue({ success: true });
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn(() => ({ run }));
  const cms = {
    handleContentList: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    handleContentListTrashed: vi.fn().mockResolvedValue({ success: true, data: { items: [] } }),
    handleContentCreate: create,
  };
  const db = { prepare: vi.fn(() => ({ bind })) } as unknown as D1Database;
  const store = new CmsReviewStore(cms as never, db);
  const save = vi.fn((reviews, timestamp) => store.importNew(reviews, timestamp));
  return { save, create, run, bind, list: cms.handleContentList };
}

afterEach(() => vi.useRealTimers());

describe("口コミ収集からCMS取り込みまで", () => {
  it("複数ページを全件取得してから下書き追加し、null・件数・固定日時を維持する", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
    const { scraper, close, visited } = fixture({
      [startUrl]: { ".rvw-item": [item("1")], 'a[rel="next"]': [{ attributes: { href: "?page=2" } }] },
      [secondUrl]: { ".rvw-item": [item("2")] },
      [detailUrl("1")]: detail(), [detailUrl("2")]: detail(),
    });
    const { save, create, bind } = cmsStore();
    const result = await importCollectedReviews(() => scraper.scrape(), save);
    expect(result).toEqual({ count: 2, addedCount: 2, scrapedAt: "2026-10-26T00:00:00.000Z" });
    expect(visited).toEqual([startUrl, secondUrl, detailUrl("1"), detailUrl("2")]);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0][0]).toMatchObject({ title: null, body: null, name: "店舗 名", reviewDate: "2026-10" });
    expect(create).toHaveBeenCalledTimes(2);
    expect(bind).toHaveBeenCalledWith(result.scrapedAt);
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(["店舗名", "店舗URL", "詳細URL", "店舗リンク欠落"])("%sの欠落はページと位置を報告し、保存しない", async (missing) => {
    const broken = item("2");
    const link = broken.children!["a.rvw-item__rst-name"][0];
    if (missing === "店舗名") link.text = "  ";
    if (missing === "店舗URL") delete link.attributes!.href;
    if (missing === "詳細URL") delete broken.attributes!["data-detail-url"];
    if (missing === "店舗リンク欠落") broken.children = {};
    const { scraper, close } = fixture({ [startUrl]: { ".rvw-item": [item("1"), broken] } });
    const { save, run } = cmsStore();
    await expect(importCollectedReviews(() => scraper.scrape(), save)).rejects.toThrow(`${startUrl} 項目2`);
    expect(save).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it.each(["詳細URL", "ID"])("ページをまたぐ%s重複を除去せず停止する", async (duplicate) => {
    const repeated = item("1");
    if (duplicate === "ID") repeated.attributes!["data-detail-url"] = "https://tabelog.com/another/1/";
    const { scraper, close } = fixture({
      [startUrl]: { ".rvw-item": [item("1")], 'a[rel="next"]': [{ attributes: { href: "?page=2" } }] },
      [secondUrl]: { ".rvw-item": [repeated] },
    });
    const { save, run } = cmsStore();
    await expect(importCollectedReviews(() => scraper.scrape(), save)).rejects.toThrow(`重複しています: ${secondUrl} 項目1`);
    expect(save).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("一覧0件では取り込みも日時更新もしない", async () => {
    const { scraper, close } = fixture({ [startUrl]: { ".rvw-item": [] } });
    const { save, run } = cmsStore();
    await expect(importCollectedReviews(() => scraper.scrape(), save)).rejects.toThrow(startUrl);
    expect(save).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("収集関数が0件を返しても取り込みを開始しない", async () => {
    const { save } = cmsStore();
    await expect(importCollectedReviews(async () => [], save)).rejects.toThrow("0件");
    expect(save).not.toHaveBeenCalled();
  });

  it.each([secondUrl, detailUrl("2")])("後続ページの失敗（%s）でも部分保存しない", async (failedUrl) => {
    const { scraper, close } = fixture({
      [startUrl]: { ".rvw-item": [item("1")], 'a[rel="next"]': [{ attributes: { href: "?page=2" } }] },
      [secondUrl]: { ".rvw-item": [item("2")] },
      [detailUrl("1")]: detail(), [detailUrl("2")]: detail(),
    }, failedUrl);
    const { save, run } = cmsStore();
    await expect(importCollectedReviews(() => scraper.scrape(), save)).rejects.toThrow("503");
    expect(save).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("保存失敗では成功結果を返さず、成功日時を更新しない", async () => {
    const { scraper } = fixture({ [startUrl]: { ".rvw-item": [item("1")] }, [detailUrl("1")]: detail() });
    const { save, create, run } = cmsStore();
    create.mockResolvedValue({ success: false, error: { code: "CONTENT_CREATE_ERROR", message: "保存失敗" } });
    await expect(importCollectedReviews(() => scraper.scrape(), save)).rejects.toThrow("保存失敗");
    expect(run).not.toHaveBeenCalled();
  });

  it("取得済みがすべて登録済みでも取得件数を保ち、追加0件と成功日時を返す", async () => {
    const { scraper } = fixture({ [startUrl]: { ".rvw-item": [item("1")] }, [detailUrl("1")]: detail() });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
    const { save, create, run, list } = cmsStore();
    list.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: "1" } }] } });
    expect(await importCollectedReviews(() => scraper.scrape(), save)).toEqual({
      count: 1, addedCount: 0, scrapedAt: "2026-10-26T00:00:00.000Z",
    });
    expect(create).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledOnce();
  });
});
