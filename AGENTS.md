# プロジェクト固有の指示

導入先のルートに `PROJECT.md` がある場合は、作業前に読み、共通ルールと併せて従ってください。
共通ルールと矛盾する場合は、プロジェクト固有の指示を優先してください。

# 作業ごとの参照先

以下の作業を行う前に、対応するファイルを読み、その規則に従ってください。規則の本文は参照先で管理し、このファイルには重複して記載しません。

| 作業 | 参照先 |
| --- | --- |
| ブランチの作成・命名・改名 | [docs/rules/branch-naming.md](docs/rules/branch-naming.md) |
| コミットメッセージの作成・修正 | [.github/instructions/commit-message.instructions.md](.github/instructions/commit-message.instructions.md) |
| 言語を問わず、コードの編集、コードコメントの作成・修正 | [docs/rules/code-comments.md](docs/rules/code-comments.md) |
| チケットのタイトル・本文の作成・更新（GitHub Issue、Azure DevOpsの作業項目など） | [docs/rules/ticket-writing.md](docs/rules/ticket-writing.md)、[日本語の文章](docs/rules/japanese-writing.md) |
| GitHub Issueの登録・完了、親子関係やラベルの設定 | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) |
| ユーザーへの日本語の最終回答 | [日本語の文章](docs/rules/japanese-writing.md) |
| PRタイトル・本文の作成・修正・自動生成 | [.github/instructions/pull-request.instructions.md](.github/instructions/pull-request.instructions.md) |
| GitHub PRの作成・更新・レビュー・マージ | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md)、[.github/pull_request_template.md](.github/pull_request_template.md) |
| リリースの準備・実行 | [共通リリース規則](docs/rules/release.md)と導入先プロジェクトのリリース手順 |

複数の作業に該当する場合は、対応する参照先をすべて確認してください。チケットの登録時は、導入先の管理ツールの項目に合わせて共通の書き方を適用してください。

## GitHubの操作

GitHubの参照・作成・更新には、GitHub連携ツールではなく `gh CLI` を使用する。
