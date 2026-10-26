import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(() => new Response("Astro")),
  scheduled: vi.fn(),
  createScheduledHandler: vi.fn(),
}));
vi.mock("@astrojs/cloudflare/handler", () => ({ handle: mocks.fetch }));
vi.mock("@emdash-cms/cloudflare/worker", () => ({
  createScheduledHandler: mocks.createScheduledHandler.mockReturnValue(mocks.scheduled),
}));
import worker from "../src/worker/astro";

it.each(["/", "/reviews", "/api/reviews", "/_emdash/admin"])("%s はCMSコンテキストを持つAstroへ渡す", async (path) => {
  const response = await worker.fetch(new Request(`https://example.com${path}`), {} as never, {} as never);
  expect(await response.text()).toBe("Astro");
});

it("定期処理はCMSの毎分保守ハンドラーだけを使う", async () => {
  vi.resetModules();
  const { default: reloaded } = await import("../src/worker/astro");
  expect(mocks.createScheduledHandler).toHaveBeenCalledWith({ generalCron: "* * * * *" });
  await reloaded.scheduled({} as never, {} as never, {} as never);
  expect(mocks.scheduled).toHaveBeenCalledOnce();
});
