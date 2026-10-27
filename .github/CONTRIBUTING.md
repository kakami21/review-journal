# GitHub Issue・PR運用規則

入力項目・記入方法・必須条件の正本は、以下のフォームのYAML。GitHubではフォームを使い、CLI・APIでも該当するYAMLを読んで同じ見出しと必須条件に従う。任意項目は必要な場合のみ記載する。

- [作業Issue（単独・子Issue）](ISSUE_TEMPLATE/task.yml)
- [親Issue（テーマ）](ISSUE_TEMPLATE/parent.yml)

## Issueの書き方

Issueはプレーンランゲージ（読み手に合う身近な言葉と短い文）で書く。目的・変更内容・完了条件に絞り、専門用語が必要なら初出で意味を添える。

- 背景・目的は、困っていることと改善したいことを2文を目安に書く
- 対応内容は、利用者から見て変わることを3〜5項目を目安に書く。調査の場合は、何を明らかにするかを書く。少ない項目で伝わる場合は増やさない
- 完了条件は、「何ができたら終わりか」を確認できるチェックリストにする
- 技術的な詳細は、判断や作業に必要な場合だけ補足へ書く。長くなる場合は別資料へ移し、リンクを付ける
- 親Issueは、全体の目的・対象範囲・子Issue・全体の完了条件に絞り、子Issueの説明を繰り返さない

参考：[英国教育省のプレーンランゲージの指針](https://design.education.gov.uk/content-design/plain-language)。

## 登録

- 既存Issueを検索し、同じ目的なら新規作成せず既存Issueを使用する
- 秘密情報・認証ヘッダー・顧客情報を含めない。未確認の原因を断定しない
- タイトルは `feat` / `fix` / `refactor` / `docs` / `test` / `chore` のいずれかで始め、`feat: 口コミの検索機能を追加` のように目的を具体的に示す。必要なら `scope` を付ける
- 原則として起票者にアサインする。担当者が決まっている場合はその人を指定する。CLI・APIからの登録でも同じ扱いとし、登録後にアサインを確認する
- 未実装や外部設定不足によるテスト失敗は、失敗を隠す変更を加えずIssueに記録する
- 登録後は内容を確認してURLを報告する。登録できなかった場合は本文を保存し、未登録と明記する

## 優先度

- 通常はラベルなし。必要な場合のみ `priority:urgent`（他の作業を中断）または `priority:next`（次に着手）を最大1つ付ける
- 優先度を付ける場合は、影響・期限・作業の妨げなどの理由を本文に1行記載する
- 本番のサービス提供に支障が出た場合だけ、別途 `incident` を付ける

## 作業の分割と完了

- 小さな作業はチェックリストで管理する。個別に実装・検証・完了を追跡する必要がある場合だけ子Issueに分割する
- 分割時はGitHubのSub-issue機能で主な親を1つ設定し、親→子の2段階までとする。本文リンクだけで紐付け完了とは扱わない
- 分割した作業の優先度は子Issueに付ける。親は完了を判断できる範囲に区切る
- 完了条件を検証し、結果をIssueに残してから完了する。親は対象の子Issueとテーマ全体の完了条件が満たされたら完了する

## Pull Request

- PRは原則として作成者自身にアサインする。担当者を明示された場合はその人を指定する。`gh pr create` では `--assignee @me` を使い、作成後にアサインを確認する。VS Codeでは `githubPullRequests.assignCreated` に `${user}` を設定する
- ブランチは [命名規則](../docs/rules/branch-naming.md) に従って最新の `main` から作成し、PRの取り込み先も `main` とする。長期運用ブランチは `main` の1つとする
- 1つのPRは1つの目的に絞る。無関係な変更は別のPRに分ける
- タイトル・本文の作成と自動生成は [PR生成規則](instructions/pull-request.instructions.md) に従い、日本語で記載する
- 作成後に取り込み先・差分・本文を確認し、URLを報告する。作成できなかった場合は本文を保存し、未作成と明記する
- マージ前に差分をレビューし、必要な検証の成功と指摘の解消を確認する。PR作成の依頼だけでマージせず、マージの依頼または事前の合意に従う
- マージ前にIssueの完了条件を確認し、検証結果とPRリンクをIssueへ記録する。`Closes` を記載したIssueはmainへのマージ時にGitHub標準機能で自動完了する。本番確認が必要なIssueは、その確認まで `Refs` として残す
- マージ後は作業ブランチを削除する

参考：[GitHubのIssueとPRの関連付け](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)、[PRテンプレート](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)。テンプレートの自動表示にはデフォルトブランチへの反映が必要。

## リリース

リリースの設計・設定・準備・実行・検証・復旧は[共通リリース規則](../docs/rules/release.md)に従う。CI、初回設定、タグによる公開、公開後の確認、GitHub Releases、DB変更、復旧までを共通の運用とする。

## プロジェクト固有の手順

ビルド・検証・リリースの具体的な手順は、導入先プロジェクトの文書で管理する。
