import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// 検証用Workerで既存画面とAPIを接続し、本番への切り替えは #11 で行う。
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
  vite: { plugins: [tailwindcss()] },
  session: false,
});
