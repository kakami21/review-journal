import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // タグ公開時はActionsのRELEASE_TAGを埋め込み、それ以外のビルドは未リリースと示す。
  define: {
    "import.meta.env.VITE_RELEASE_TAG": JSON.stringify(process.env.RELEASE_TAG ?? "unreleased"),
  },
  plugins: [tailwindcss(), react(), cloudflare()],
});
