import { defineConfig } from "vitest/config";

// WorkerやAstroの開発サーバーを起動せず、移行時のHTTP境界だけを検証する。
export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
