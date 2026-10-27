import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

let directory: string;
const script = resolve("scripts/download-production.sh");
const sha = "a".repeat(40);

// GitHubとの通信だけを置き換え、取得条件・実際のtar展開と失敗時の停止を検証する。
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "production-artifact-"));
  mkdirSync(join(directory, "bin"));
  writeFileSync(join(directory, "bin/gh"), `#!/usr/bin/env bash
set -eu
printf '%s\\n' "$*" >> "$GH_CALLS"
if [ "$2" = list ]; then
  printf '%s' "$CI_RUN"
else
  test "$DOWNLOAD_FAIL" = 0
  cp "$ARCHIVE" production.tar.gz
fi
`, { mode: 0o755 });
  mkdirSync(join(directory, "source/dist/astro-production/server"), { recursive: true });
  mkdirSync(join(directory, "source/astro/.emdash"), { recursive: true });
  writeFileSync(join(directory, "source/dist/astro-production/server/entry.mjs"), "検証済みのWorker");
  writeFileSync(join(directory, "source/astro/.emdash/migrations.json"), "{}");
  execFileSync("tar", ["-czf", join(directory, "artifact.tar.gz"), "dist/astro-production", "astro/.emdash/migrations.json"], { cwd: join(directory, "source") });
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function download(overrides: Record<string, string> = {}) {
  execFileSync("bash", [script], { cwd: directory, env: {
    ...process.env, PATH: `${directory}/bin:${process.env.PATH}`,
    GITHUB_REPOSITORY: "owner/repo", RELEASE_SHA: sha,
    GITHUB_STEP_SUMMARY: join(directory, "summary"), GH_CALLS: join(directory, "calls"),
    CI_RUN: "123", DOWNLOAD_FAIL: "0", ARCHIVE: join(directory, "artifact.tar.gz"), ...overrides,
  }, stdio: "pipe" });
}

it("同じコミットのmain・push・成功済みCIを選び、Workerと隠しパスのCMS情報を展開する", () => {
  download();
  const calls = readFileSync(join(directory, "calls"), "utf8");
  expect(calls).toContain(`--workflow ci.yml --branch main --event push --commit ${sha} --status success`);
  expect(calls).toContain(`run download 123 --repo owner/repo --name production-${sha}`);
  expect(readFileSync(join(directory, "dist/astro-production/server/entry.mjs"), "utf8")).toBe("検証済みのWorker");
  expect(readFileSync(join(directory, "astro/.emdash/migrations.json"), "utf8")).toBe("{}");
  expect(readFileSync(join(directory, "summary"), "utf8")).toContain("owner/repo/actions/runs/123");
});
it("成功したCIがなければダウンロードせず停止する", () => {
  expect(() => download({ CI_RUN: "" })).toThrow();
  expect(readFileSync(join(directory, "calls"), "utf8")).not.toContain("run download");
  expect(existsSync(join(directory, "dist"))).toBe(false);
});
it("成果物の取得失敗では展開せず停止する", () => {
  expect(() => download({ DOWNLOAD_FAIL: "1" })).toThrow();
  expect(existsSync(join(directory, "dist"))).toBe(false);
});
it("壊れたアーカイブを受け取った場合も停止する", () => {
  writeFileSync(join(directory, "artifact.tar.gz"), "broken");
  expect(() => download()).toThrow();
  expect(existsSync(join(directory, "summary"))).toBe(false);
});
