# PRタイトル・本文の生成規則

## 言語と根拠

- タイトル・本文・見出しは日本語で記載する。コード識別子、コマンド、製品名、Conventional Commitsのtype・scopeは元の表記を維持する
- 取り込み先と取り込み元の差分全体を根拠にする。直近のコミットだけでPR全体を説明しない
- 変更の目的と変更後の動作を簡潔に説明する。会話の経緯、挨拶、生成結果の前置きは含めない
- 実行していないテストや未確認の動作を、確認済みとして記載しない。不明なIssue番号を補わない

## タイトル

- `<type>[任意の(scope)]: <日本語の要約>` の形式にする
- typeは `feat` / `fix` / `refactor` / `docs` / `test` / `chore` から変更の主目的に合うものを1つ選ぶ
- scopeは必要な場合だけ英小文字で指定する。要約の末尾に句点を付けない
- `develop` から `main` へのリリースPRは、差分全体の主な変更が分かる要約にする

例：`chore: PR運用規則とVS Codeのマージ設定を整備`

## 本文

- `.github/pull_request_template.md` の「変更内容」「検証結果」「関連Issue」の構成を使う
- 変更内容：解決する問題と変更後の動作を記載する。複数の変更を含むリリースでは、主要な変更を箇条書きにする
- 検証結果：実行した確認と結果を記載し、未実施の確認や残る制約を区別する。結果が提供されていない場合は「未確認」と記載する
- 関連Issue：デフォルトブランチ（現在は `main`）向けPRで、取り込みにより完了条件を満たすIssueは、PR本文に `Closes #番号` と記載する。完了条件と検証結果を確認できないIssueや、参照だけのIssueは `Refs #番号` にする
- `develop` 向けPRでは `Refs #番号` を使う。リリースPRの作成時に取り込み済みPRの関連Issueも確認し、完了条件を満たす未完了IssueをPR本文の `Closes #番号` に含める。コミットメッセージやコメント欄だけに完了指定を置かない
- 複数のIssueを完了する場合は、それぞれに `Closes #番号` を記載する。関連Issueがない場合は「なし」、情報がない場合は「未確認」と記載し、番号や完了を推測しない

## リリースPR作成前の必須調査

`develop` から `main` へのPRを作成・更新するエージェントは、本文を生成する前に次の手順を実行する。ブランチ名や会話の記憶だけで関連Issueを判断しない。

1. リモートの履歴を取得し、未反映のコミットと実際の差分を確認する。ローカルの `main`・`develop` が最新であるとは限らないため、`origin` の参照を使う。

   ```sh
   git fetch origin
   git log --first-parent --format='%H %s%n%b' origin/main..origin/develop
   git diff --stat origin/main origin/develop
   git diff origin/main origin/develop
   ```

2. コミットから対象PRを特定し、GitHubの記録を `gh CLI` で確認する。コミット末尾の `(#番号)` はPR番号であり、Issue番号として扱わない。

   ```sh
   gh pr view <PR番号> --json number,title,body,state,baseRefName,mergeCommit
   ```

   コミットにPR番号がない場合は、以下で関連PRを調査する。対象リポジトリは `gh repo view --json nameWithOwner --jq .nameWithOwner` で確認する。

   ```sh
   gh api repos/<owner>/<repo>/commits/<コミットSHA>/pulls
   ```

3. `develop` にマージ済みの対象PRの「関連Issue」欄を照合する。本文中で言及されただけのIssueや親テーマを、実装済み・完了対象とみなさない。PRがないコミット、関連付けが不明なPRも一覧から除外せず「要確認」とする。
4. 関連Issueごとに、現在の状態・完了条件・検証結果を確認する。

   ```sh
   gh issue view <Issue番号> --json number,title,state,body
   ```

5. リリースPR本文の「関連Issue」に、対象PR・対応Issue・現在の状態を表で必ず記載する。完了済みIssueも含め、関連なしは「なし」、判断材料が足りない場合は「要確認」とする。
6. 未完了で、この取り込みにより完了条件を満たすことを確認できたIssueだけ、表とは別の行に `Closes #番号` を記載する。既に閉じたIssueや参照のみのIssueには `Refs #番号` を使う。履歴に載っているだけで自動完了を決めない。

履歴やGitHub情報を取得できない場合は、確認できなかった範囲を明記し、関連Issueを「なし」と断定したり `Closes` を推測したりしない。本文の生成だけを行う機能でコマンドを実行できない場合も、調査済みとは記載しない。

PRの作成先、レビュー、マージ、Issueの完了手順は `.github/CONTRIBUTING.md` に従う。
