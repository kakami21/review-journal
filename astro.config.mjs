import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import emdash from "emdash/astro";
import { d1, r2 } from "@emdash-cms/cloudflare";

// 本番は明示したビルドだけで選択し、通常の開発とstagingは検証用Worker・D1を使う。
const production = process.env.ASTRO_ENV === "production";
export default defineConfig({
  output: "server",
  outDir: fileURLToPath(new URL(production ? "./dist/astro-production/" : "./dist/astro/", import.meta.url)),
  adapter: cloudflare({
    configPath: new URL(production ? "./wrangler.astro.production.jsonc" : "./wrangler.astro.jsonc", import.meta.url).pathname,
    imageService: "passthrough",
    remoteBindings: true,
    persistState: { path: fileURLToPath(new URL("./.wrangler/state/", import.meta.url)) },
  }),
  integrations: [react(), emdash({
    database: d1({ binding: "DB" }),
    storage: r2({ binding: "MEDIA" }),
    migrations: { runtime: production ? "check" : "auto", dev: "auto" },
    registry: false,
    fonts: false,
    plugins: [
      { id: "review-source-policy", version: "1.0.0", entrypoint: fileURLToPath(new URL("./src/lib/cms/review-policy.mjs", import.meta.url)) },
      {
        id: "review-import", version: "1.0.0",
        entrypoint: fileURLToPath(new URL("./src/lib/cms/review-import-plugin.ts", import.meta.url)),
        adminEntry: fileURLToPath(new URL("./src/lib/cms/review-import-admin.tsx", import.meta.url)),
        adminPages: [{ path: "/import", label: "口コミの取り込み", icon: "download" }],
      },
    ],
  })],
  vite: { plugins: [tailwindcss()], define: { "import.meta.env.PUBLIC_RELEASE_TAG": JSON.stringify(process.env.RELEASE_TAG ?? "unreleased") } },
});
