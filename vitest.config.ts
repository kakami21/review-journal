import { configDefaults, defineConfig } from "vitest/config";

// WorkerやAstroの開発サーバーを起動せず、移行時のHTTP境界だけを検証する。
export default defineConfig({ test: {
  include: ["tests/**/*.test.{ts,tsx}"],
  exclude: [...configDefaults.exclude, "tests/cms.integration.test.ts"],
  // 実CMSのテストでもAstroが供給する設定だけを差し替え、保存・公開処理は本体を実行する。
  server: { deps: { inline: ["emdash"] } },
} });
