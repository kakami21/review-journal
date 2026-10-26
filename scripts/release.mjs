import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** 正式リリースだけを受け付け、ゼロ埋めやプレリリースを本番へ混入させない。 */
export function validateTag(tag) {
  if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) {
    throw new Error("リリースタグは vMAJOR.MINOR.PATCH で指定してください。");
  }
}

/** イベントのコミット・実際のタグ先・mainの履歴が一致する場合だけ公開を許可する。 */
export function checkTag(tag, commit, cwd = process.cwd()) {
  validateTag(tag);
  const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  const head = git(["rev-parse", "HEAD"]);
  const tagged = git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`]);
  if (head !== commit || tagged !== commit) throw new Error("実行コミットとタグ先が一致しません。");
  execFileSync("git", ["merge-base", "--is-ancestor", commit, "refs/remotes/origin/main"], { cwd });
}

/** #11で明示的に切り替えるまで、Astro検証用Worker・開発用D1の本番公開を拒否する。 */
export function checkProduction(config) {
  if (config.name !== "dining-archive" || config.account_id !== "981a5c317da0eac85b328bc8dbcd9f6a"
    || config.d1_databases?.length !== 1
    || config.d1_databases[0].database_id !== "16a07a44-0646-4227-941d-93b3c2f6d1f8"
    || config.routes?.length !== 1 || config.routes[0].pattern !== "pakoirileo.nokishita.app"
    || config.routes[0].custom_domain !== true) {
    throw new Error("本番Worker・アカウント・D1・ドメインの設定が一致しません。");
  }
}

if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check-tag") checkTag(args[0], args[1]);
  else if (command === "check-production") checkProduction(JSON.parse(readFileSync(args[0], "utf8")));
  else throw new Error("check-tag または check-production を指定してください。");
}
