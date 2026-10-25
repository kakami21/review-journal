import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

// #7では検証環境を独立させ、既存画面・Hono APIの切り替えは #8 で行う。
export default defineConfig({
  root: fileURLToPath(new URL("./astro/", import.meta.url)),
  srcDir: fileURLToPath(new URL("./src/", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
  output: "server",
  outDir: fileURLToPath(new URL("./dist/astro/", import.meta.url)),
  adapter: cloudflare({
    configPath: new URL("./wrangler.astro.jsonc", import.meta.url).pathname,
    imageService: "passthrough",
  }),
  integrations: [react()],
  session: false,
});
