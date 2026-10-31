import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { checkProduction, checkTag, validateTag } from "../scripts/release.mjs";

let directory: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();

// 実際のGit履歴でmainへの包含とタグの付け替えを検証し、通信や本番公開は行わない。
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "table-notes-release-"));
  git("init", "--initial-branch=main");
  git("config", "user.name", "Release Test");
  git("config", "user.email", "release@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("config", "tag.gpgsign", "false");
  git("commit", "--allow-empty", "-m", "initial");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it.each(["v0.0.0", "v1.2.3", "v10.20.300"])("正式タグ %s を受理する", (tag) => {
  expect(() => validateTag(tag)).not.toThrow();
});
it.each(["1.2.3", "v1.2", "v01.2.3", "v1.02.3", "v1.2.03", "v1.2.3-beta", "v1.2.3+build", "v1.2.3\n"])("不正なタグ %s を拒否する", (tag) => {
  expect(() => validateTag(tag)).toThrow();
});
it("main上の注釈付きタグと実行コミットの一致を検証する", () => {
  git("tag", "-a", "v1.2.3", "-m", "release");
  expect(() => checkTag("v1.2.3", git("rev-parse", "HEAD"), directory)).not.toThrow();
});
it("mainに未取り込みのコミットは拒否する", () => {
  git("switch", "-c", "feature");
  git("commit", "--allow-empty", "-m", "unmerged");
  git("tag", "v1.2.3");
  expect(() => checkTag("v1.2.3", git("rev-parse", "HEAD"), directory)).toThrow();
});
it("イベント発生後に別コミットへ移されたタグは拒否する", () => {
  const original = git("rev-parse", "HEAD");
  git("tag", "v1.2.3");
  git("commit", "--allow-empty", "-m", "changed");
  git("tag", "-f", "v1.2.3");
  git("checkout", "--detach", original);
  expect(() => checkTag("v1.2.3", original, directory)).toThrow("一致しません");
});

const production = {
  name: "dining-archive", account_id: "981a5c317da0eac85b328bc8dbcd9f6a",
  d1_databases: [{ database_id: "16a07a44-0646-4227-941d-93b3c2f6d1f8" }],
  kv_namespaces: [{ binding: "SESSION", id: "d3419d12971c4d3ca72503b4d3674016" }],
  triggers: { crons: ["* * * * *"] },
  routes: [{ pattern: "pakoirileo.nokishita.app", custom_domain: true }],
};
it("本番の生成設定を受理する", () => expect(() => checkProduction(production)).not.toThrow());
it.each([
  { name: "table-notes-astro-staging" }, { account_id: "other-account" },
  { d1_databases: [{ database_id: "29d7ef4b-65b8-4a71-8820-3eaee6d9fe4a" }] },
  { kv_namespaces: [] }, { kv_namespaces: [{ binding: "SESSION", id: "f9b3b197ea954dc9907d6dd09a6e3a28" }] },
  { triggers: { crons: [] } }, { routes: [] }, { routes: [{ pattern: "other.example", custom_domain: true }] },
])("本番以外の接続先を拒否する", (change) => {
  expect(() => checkProduction({ ...production, ...change })).toThrow();
});
