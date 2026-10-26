<!-- BEGIN:development-standards -->

# 作業ごとの参照先

以下の作業を行う前に、対応するファイルを読み、その規則に従ってください。規則の本文は参照先で管理し、このファイルには重複して記載しません。

| 作業 | 参照先 |
| --- | --- |
| ブランチの作成・命名・改名 | [.github/instructions/branch-naming.instructions.md](instructions/branch-naming.instructions.md) |
| コミットメッセージの作成・修正 | [.github/instructions/commit-message.instructions.md](instructions/commit-message.instructions.md) |
| 言語を問わず、コードの編集、コードコメントの作成・修正 | [.github/instructions/code-comments.instructions.md](instructions/code-comments.instructions.md) |
| GitHub Issueの作成・更新・完了、親子関係やラベルの設定 | [.github/CONTRIBUTING.md](CONTRIBUTING.md) |
| PRの作成・更新・レビュー・マージ | [.github/CONTRIBUTING.md](CONTRIBUTING.md)、[.github/pull_request_template.md](pull_request_template.md) |
| PRタイトル・本文の作成・修正・自動生成 | [.github/instructions/pull-request.instructions.md](instructions/pull-request.instructions.md) |
| 作業Issue（単独・子Issue）の本文の作成・更新 | [.github/ISSUE_TEMPLATE/task.yml](ISSUE_TEMPLATE/task.yml) |
| リリースの準備・実行 | [共通リリース規則](instructions/release.instructions.md)と導入先プロジェクトのリリース手順 |
| 親Issue（テーマ）の本文の作成・更新 | [.github/ISSUE_TEMPLATE/parent.yml](ISSUE_TEMPLATE/parent.yml) |

複数の作業に該当する場合は、対応する参照先をすべて確認してください。IssueをCLI・APIから登録する場合も、運用規則と該当するフォームのYAMLを読んでください。

## GitHubの操作

GitHubの参照・作成・更新には、GitHub連携ツールではなく `gh CLI` を使用する。

<!-- END:development-standards -->

## table-notes固有の規則

リリースの準備・実行時は、[リリース手順](../docs/releases.md)を読み、運用原則と検証手順に従ってください。

共通ルールの導入・更新は[共有ルールの運用](../docs/development-standards.md)を参照してください。
