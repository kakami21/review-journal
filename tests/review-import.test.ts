import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 公開テスト用エントリーがAstroの仮想モジュールを要求するため、導入済み本体の認可境界を直接検証する。
import { dispatchPluginApiRequest } from "../node_modules/emdash/src/plugins/http-route-dispatch";

const mocks = vi.hoisted(() => {
  const run = vi.fn();
  const bind = vi.fn(() => ({ run }));
  return {
    run, bind, scrape: vi.fn(), runtime: vi.fn(),
    env: { TABELOG_USERNAME: "test", BROWSER: {}, DB: { prepare: vi.fn(() => ({ bind })) } },
    cms: { handleContentList: vi.fn(), handleContentListTrashed: vi.fn(), handleContentCreate: vi.fn() },
  };
});
vi.mock("cloudflare:workers", () => ({ env: mocks.env }));
vi.mock("emdash/middleware", () => ({ withEmDashRuntime: mocks.runtime }));
vi.mock("../src/infrastructure/cloudflare-browser-provider", () => ({ CloudflareBrowserProvider: class {} }));
vi.mock("../src/reviews/tabelog-review-scraper", () => ({ TabelogReviewScraper: class { scrape = mocks.scrape; } }));
import { createPlugin } from "../src/cms/review-import-plugin";

const plugin = createPlugin();
const route = plugin.routes!.run;
const admin = { id: "admin", email: "admin@example.invalid", name: "管理者", role: 50, createdAt: "2026-10-26" };
const review = { id: "new", name: "店舗", url: "https://tabelog.com/restaurant/1/", detailUrl: "https://tabelog.com/rvwdtl/1/",
  title: null, body: "本文", reviewDate: "2026-10", rating: 4, likeCount: 3 };
const timestamp = "2026-10-26T00:00:00.000Z";
const invoke = vi.fn(async () => ({ success: true, data: await route.handler({} as never) }));

// EmDash本体のHTTP認可・CSRF・メソッド制限を通し、認証済みのユーザー情報以降を検証する。
// セッションCookieからのユーザー解決はローカル実CMSの結合確認で補う。
async function request(user: typeof admin | null = admin, method = "POST", csrf: string | null = "1", tokenScopes?: string[]) {
  return dispatchPluginApiRequest({
    pluginId: plugin.id, path: "/run", user, tokenScopes,
    request: new Request("https://example.com/_emdash/api/plugins/review-import/run", {
      method, headers: { ...(csrf ? { "X-EmDash-Request": csrf } : {}), "Content-Type": "application/json" },
      ...(method === "POST" ? { body: "{}" } : {}),
    }),
    runtime: {
      getPluginRouteMeta: () => ({ public: false, permission: route.permission, methods: route.methods }),
      handlePluginApiRoute: invoke,
    } as never,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(timestamp));
  mocks.env.DB.prepare.mockReturnValue({ bind: mocks.bind });
  mocks.bind.mockReturnValue({ run: mocks.run });
  mocks.run.mockResolvedValue({ success: true });
  mocks.runtime.mockImplementation(async (callback) => callback(mocks.cms));
  mocks.scrape.mockResolvedValue([review]);
  mocks.cms.handleContentList.mockResolvedValue({ success: true, data: { items: [] } });
  mocks.cms.handleContentListTrashed.mockResolvedValue({ success: true, data: { items: [] } });
  mocks.cms.handleContentCreate.mockResolvedValue({ success: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("管理画面の取り込み", () => {
  it.each([
    [null, "POST", "1", 401], [{ ...admin, role: 30 }, "POST", "1", 403],
    [admin, "POST", null, 403], [admin, "POST", "0", 403],
    [admin, "GET", "1", 405], [admin, "PUT", "1", 405],
  ] as const)("未認証・権限不足・CSRF不正・POST以外は実行しない", async (user, method, csrf, status) => {
    const response = await request(user, method, csrf);
    expect(response.status).toBe(status);
    expect(invoke).not.toHaveBeenCalled();
    expect(mocks.scrape).not.toHaveBeenCalled();
    expect(mocks.cms.handleContentCreate).not.toHaveBeenCalled();
  });

  it("adminスコープのないトークンでは管理者でも実行しない", async () => {
    expect((await request(admin, "POST", null, ["content:write"])).status).toBe(403);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("管理者のPOSTは新規分を下書き追加し、件数と成功日時を返す", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ success: true, data: { ok: true, count: 1, addedCount: 1, scrapedAt: timestamp } });
    expect(mocks.cms.handleContentCreate).toHaveBeenCalledWith("reviews", expect.objectContaining({
      slug: review.id, status: "draft", data: expect.objectContaining({ source_id: review.id, body: review.body }),
    }));
    expect(mocks.bind).toHaveBeenCalledWith(timestamp);
  });

  it("公開・下書き・ゴミ箱の登録済み口コミを上書きせず、追加0件を成功とする", async () => {
    mocks.scrape.mockResolvedValue([review, { ...review, id: "trash" }]);
    mocks.cms.handleContentList.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: review.id } }] } });
    mocks.cms.handleContentListTrashed.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: "trash" } }] } });
    expect((await (await request()).json()).data).toEqual({ ok: true, count: 2, addedCount: 0, scrapedAt: timestamp });
    expect(mocks.cms.handleContentCreate).not.toHaveBeenCalled();
  });

  it.each(["error", "empty"])("取得失敗・0件は保存を始めず、内部情報を返さない", async (failure) => {
    if (failure === "error") mocks.scrape.mockRejectedValue(new Error("秘密の内部情報"));
    else mocks.scrape.mockResolvedValue([]);
    const response = await request();
    expect(await response.json()).toEqual({ success: true, data: { ok: false, stage: "collection" } });
    expect(mocks.runtime).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("途中保存失敗後の再実行は追加済みを除外し、全件成功後だけ日時を更新する", async () => {
    const second = { ...review, id: "second" };
    mocks.scrape.mockResolvedValue([review, second]);
    mocks.cms.handleContentCreate.mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: { code: "ERROR", message: "秘密の内部情報" } });
    expect((await (await request()).json()).data).toEqual({ ok: false, stage: "save" });
    expect(mocks.run).not.toHaveBeenCalled();
    mocks.cms.handleContentList.mockResolvedValue({ success: true, data: { items: [{ data: { source_id: review.id } }] } });
    mocks.cms.handleContentCreate.mockClear();
    expect((await (await request()).json()).data).toEqual({ ok: true, count: 2, addedCount: 1, scrapedAt: timestamp });
    expect(mocks.cms.handleContentCreate).toHaveBeenCalledOnce();
    expect(mocks.cms.handleContentCreate).toHaveBeenCalledWith("reviews", expect.objectContaining({ slug: "second" }));
    expect(mocks.run).toHaveBeenCalledOnce();
  });
});
