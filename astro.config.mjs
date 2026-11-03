import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import emdash from "emdash/astro";
import { d1, r2 } from "@emdash-cms/cloudflare";

// 通常のローカル起動はpreview資産に接続し、本番は明示したビルドだけで選ぶ。
const environment = process.env.ASTRO_ENV ?? "preview";
if (!["preview", "production"].includes(environment)) throw new Error("ASTRO_ENVはpreviewまたはproductionを指定してください。");
const production = environment === "production";
export default defineConfig({
  output: "server",
  outDir: fileURLToPath(new URL(`./dist/astro-${environment}/`, import.meta.url)),
  adapter: cloudflare({
    configPath: new URL(`./wrangler.astro.${environment}.jsonc`, import.meta.url).pathname,
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
      { id: "review-source-policy", version: "1.0.0", entrypoint: fileURLToPath(new URL("./src/lib/cms/content-save-policy-plugin.mjs", import.meta.url)) },
      {
        id: "review-import", version: "1.0.0",
        entrypoint: fileURLToPath(new URL("./src/lib/cms/review-import-plugin.ts", import.meta.url)),
        adminEntry: fileURLToPath(new URL("./src/lib/cms/review-import-page.tsx", import.meta.url)),
        adminPages: [{ path: "/import", label: "口コミの取り込み", icon: "download" }],
      },
    ],
  })],
  vite: { plugins: [tailwindcss()], define: { "import.meta.env.PUBLIC_RELEASE_TAG": JSON.stringify(process.env.RELEASE_TAG ?? "unreleased") } },
});
