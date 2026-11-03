import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// ローカル起動が本番資産やローカルの模擬ストレージへ接続しない契約を固定する。
it("previewとproductionの資産を分離し、開発時はpreviewのリモート資産を使う", () => {
  const preview = JSON.parse(readFileSync("wrangler.astro.preview.jsonc", "utf8"));
  const production = JSON.parse(readFileSync("wrangler.astro.production.jsonc", "utf8"));
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
  expect(scripts.dev).toBe("ASTRO_ENV=preview astro dev");
  for (const [environment, config] of [["preview", preview], ["production", production]] as const) {
    expect(config.name).toBe(`table-notes-${environment}`);
    expect(config.d1_databases[0].database_name).toBe(`table-notes-${environment}-db`);
    expect(config.r2_buckets[0].bucket_name).toBe(`table-notes-${environment}-media`);
    for (const binding of [...config.d1_databases, ...config.kv_namespaces, ...config.r2_buckets]) {
      expect(binding.remote).toBe(true);
    }
  }
  expect(preview.d1_databases[0].database_id).not.toBe(production.d1_databases[0].database_id);
  expect(preview.kv_namespaces[0].id).not.toBe(production.kv_namespaces[0].id);
});
