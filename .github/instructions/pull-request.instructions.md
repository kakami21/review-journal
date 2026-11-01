# PRタイトル・本文の生成規則

## 言語と根拠

- タイトル・本文・見出しは日本語で記載する。コード識別子、コマンド、製品名、Conventional Commitsのtype・scopeは元の表記を維持する
- 取り込み先と取り込み元の差分全体を根拠にする。直近のコミットだけでPR全体を説明しない
- 変更の目的と変更後の動作を簡潔に説明する。会話の経緯、挨拶、生成結果の前置きは含めない
- 実行していないテストや未確認の動作を、確認済みとして記載しない。不明なチケットのIDを補わない

## タイトル

- `<type>[任意の(scope)]: <日本語の要約>` の形式にする
- typeは `feat` / `fix` / `refactor` / `docs` / `test` / `chore` から変更の主目的に合うものを1つ選ぶ
- scopeは必要な場合だけ英小文字で指定する。要約の末尾に句点を付けない

例：`chore: PR運用規則とVS Codeのマージ設定を整備`

## 本文

- 「変更内容」「検証結果」「関連作業」の構成を使う。GitHubでは`.github/pull_request_template.md`を参照する
- 変更内容：解決する問題と変更後の動作を記載する
- 検証結果：実行した確認と結果を記載し、未実施の確認や残る制約を区別する。結果が提供されていない場合は「未確認」と記載する
- 関連作業：完了または参照するチケットのIDやリンクを記載する。関連するものがなければ「なし」、不明なら「未確認」とする
- PR番号とチケットのIDを混同せず、確認していないテスト結果や完了を推測しない

取り込み先とPRの作成・レビュー・マージ操作は、導入先のプロジェクトと管理ツールの規則に従う。GitHubでの操作は`.github/CONTRIBUTING.md`を参照する。

## 参考資料

- [Conventional Commits 1.0.0（日本語）](https://www.conventionalcommits.org/ja/v1.0.0/)：タイトルに応用しているtype・scopeの形式。仕様自体の対象はコミットメッセージ。
- [Google Engineering Practices — Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html)：変更内容と理由を、後から読んでも理解できる説明にするための指針。

PRタイトルへのConventional Commits形式の適用、日本語での記述、「変更内容」「検証結果」「関連作業」の構成は、このリポジトリの規則とする。
