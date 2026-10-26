import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import emdash from "emdash/astro";
import { d1 } from "@emdash-cms/cloudflare";

// 本番は明示したビルドだけで選択し、通常の開発は検証用WorkerとローカルDBを使う。
const production = process.env.ASTRO_ENV === "production";
export default defineConfig({
  root: fileURLToPath(new URL("./astro/", import.meta.url)),
  srcDir: fileURLToPath(new URL("./src/", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
  output: "server",
  outDir: fileURLToPath(new URL(production ? "./dist/astro-production/" : "./dist/astro/", import.meta.url)),
  adapter: cloudflare({
    configPath: new URL(production ? "./wrangler.astro.production.jsonc" : "./wrangler.astro.jsonc", import.meta.url).pathname,
    imageService: "passthrough",
    remoteBindings: false,
    persistState: { path: fileURLToPath(new URL("./.wrangler/state/", import.meta.url)) },
  }),
  integrations: [react(), emdash({
    database: d1({ binding: "DB" }),
    migrations: { runtime: production ? "check" : "auto", dev: "auto" },
    registry: false,
    fonts: false,
    plugins: [{ id: "review-source-policy", version: "1.0.0", entrypoint: fileURLToPath(new URL("./src/cms/review-policy.mjs", import.meta.url)) }],
  })],
  vite: { plugins: [tailwindcss()], define: { "import.meta.env.PUBLIC_RELEASE_TAG": JSON.stringify(process.env.RELEASE_TAG ?? "unreleased") } },
});
