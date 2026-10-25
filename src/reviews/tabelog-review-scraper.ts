import type { Review } from "./review";

export interface ScrapingLocator {
  count(): Promise<number>;
  first(): ScrapingLocator;
  nth(index: number): ScrapingLocator;
  locator(selector: string): ScrapingLocator;
  innerText(): Promise<string>;
  getAttribute(name: string): Promise<string | null>;
}

export interface ScrapingPage {
  goto(
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ): Promise<{ ok(): boolean; status(): number } | null>;
  locator(selector: string): ScrapingLocator;
  waitForTimeout(timeout: number): Promise<void>;
}

export interface BrowserSession {
  newPage(options: { locale: string }): Promise<ScrapingPage>;
  close(): Promise<void>;
}

export interface BrowserProvider {
  open(): Promise<BrowserSession>;
}

const WAIT_MS = 1_000;

type ReviewLink = Pick<Review, "id" | "name" | "url" | "detailUrl">;

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

function parseReviewDate(text: string, url: string) {
  const match = normalize(text).match(/^(\d{4})\/(\d{2})\s*訪問(?:\s*\d+回目)?$/);

  if (!match) {
    throw new Error(`口コミの日付が不正です: ${text} ${url}`);
  }

  return `${match[1]}-${match[2]}`;
}

function getReviewId(detailUrl: string) {
  const id = new URL(detailUrl).pathname.split("/").filter(Boolean).at(-1);

  if (!id) {
    throw new Error(`口コミIDが見つかりませんでした: ${detailUrl}`);
  }

  return id;
}

async function openPage(page: ScrapingPage, url: string, target: string) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  if (!response?.ok()) {
    throw new Error(
      `${target}の取得に失敗しました: ${response?.status() ?? "応答なし"} ${url}`,
    );
  }
}

async function optionalText(locator: ScrapingLocator) {
  return (await locator.count()) > 0 ? normalize(await locator.innerText()) : null;
}

async function collectReviewLinks(page: ScrapingPage, startUrl: string) {
  const reviews = new Map<string, ReviewLink>();
  let url: string | null = startUrl;

  while (url) {
    await openPage(page, url, "一覧ページ");

    const items = page.locator(".rvw-item");
    const itemCount = await items.count();

    if (itemCount === 0) {
      throw new Error(`店舗情報が見つかりませんでした: ${url}`);
    }

    for (let index = 0; index < itemCount; index += 1) {
      const item = items.nth(index);
      const link = item.locator("a.rvw-item__rst-name");
      const name = await optionalText(link);
      const restaurantPath = await link.getAttribute("href");
      const detailPath = await item.getAttribute("data-detail-url");

      if (name && restaurantPath && detailPath) {
        const detailUrl = new URL(detailPath, url).href;
        reviews.set(detailUrl, {
          id: getReviewId(detailUrl),
          name,
          url: new URL(restaurantPath, url).href,
          detailUrl,
        });
      }
    }

    const nextLink = page.locator('a[rel="next"]');
    const nextPath =
      (await nextLink.count()) > 0 ? await nextLink.getAttribute("href") : null;
    url = nextPath ? new URL(nextPath, url).href : null;
    if (url) await page.waitForTimeout(WAIT_MS);
  }

  return [...reviews.values()];
}

async function scrapeReview(page: ScrapingPage, link: ReviewLink) {
  await openPage(page, link.detailUrl, "口コミ詳細ページ");

  const likeElement = page
    .locator(".rvw-item__vote-like .js-like-btn-count > span")
    .first();
  const likeText = await optionalText(likeElement);
  const rating = Number(
    await page.locator(".rvw-item__ratings--val").first().innerText(),
  );
  const likeCount = Number(likeText ?? 0);
  const reviewDate = parseReviewDate(
    await page.locator(".rvw-item__date").first().innerText(),
    link.detailUrl,
  );

  if (!Number.isFinite(rating) || !Number.isInteger(likeCount)) {
    throw new Error(`点数またはいいね数が不正です: ${link.detailUrl}`);
  }

  return {
    review: {
      ...link,
      title: await optionalText(page.locator(".rvw-item__title").first()),
      body: await optionalText(page.locator(".rvw-item__rvw-comment").first()),
      reviewDate,
      rating,
      likeCount,
    } satisfies Review,
    foundLikeElement: likeText !== null,
  };
}

export class TabelogReviewScraper {
  private readonly startUrl: string;

  constructor(
    private readonly browserProvider: BrowserProvider,
    tabelogUsername: string,
  ) {
    if (!tabelogUsername) {
      throw new Error("TABELOG_USERNAMEを設定してください。");
    }

    this.startUrl = `https://tabelog.com/rvwr/${encodeURIComponent(tabelogUsername)}/reviewed_restaurants/list`;
  }

  async scrape() {
    const browser = await this.browserProvider.open();

    try {
      const links = await collectReviewLinks(
        await browser.newPage({ locale: "ja-JP" }),
        this.startUrl,
      );
      const detailPage = await browser.newPage({ locale: "ja-JP" });
      const reviews: Review[] = [];
      let foundLikeElement = false;

      for (const link of links) {
        const result = await scrapeReview(detailPage, link);
        reviews.push(result.review);
        foundLikeElement ||= result.foundLikeElement;
        await detailPage.waitForTimeout(WAIT_MS);
      }

      if (!foundLikeElement) {
        throw new Error(
          "全件でいいね数が見つかりませんでした。DOM構造を確認してください。",
        );
      }

      return reviews;
    } finally {
      await browser.close();
    }
  }
}
