#!/usr/bin/env bash
# タグと同じコミットの成功済みmain CIだけを使い、成果物がなければ公開を停止する。
set -euo pipefail
ci_run=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow ci.yml --branch main \
  --event push --commit "$RELEASE_SHA" --status success --limit 1 \
  --json databaseId --jq '.[0].databaseId')
test -n "$ci_run"
gh run download "$ci_run" --repo "$GITHUB_REPOSITORY" --name "production-$RELEASE_SHA"
tar -xzf production.tar.gz
printf '\n- 成果物のCI実行: https://github.com/%s/actions/runs/%s\n' "$GITHUB_REPOSITORY" "$ci_run" >> "$GITHUB_STEP_SUMMARY"
