# 開発ガイド

このリポジトリで、AIと相談して仕様を決め、実装を進めるときの手順。OpenSpecの使い方と、GitHubのIssue・PRの運用をまとめる。

## まず覚えること

1. 作る内容が決まっていなければ、まず `openspec-explore` で壁打ちする。
2. 話がまとまったら `openspec-propose` で文書にし、内容を確認してから `openspec-apply-change` で実装する。
3. 実装と動作確認が終わったら、`openspec-archive-change` で完成した内容を記録する。

初めて使うときは、次の「OpenSpecで相談・仕様作成・実装を進める」を読む。スキルの使い分けやGitHubの操作ルールは、必要なときに該当する節を開く。

## OpenSpecで相談・仕様作成・実装を進める

### 1. まず壁打ちする

- Codexのチャットで `openspec-explore` を選ぶか、次の例のように `$` を付けて送る。ターミナルで実行するコマンドとは別の使い方になる。
- 困っていることや、できるようにしたいことを伝える。解決方法や細かい仕様は、最初から決めていなくてよい。
- AIが現在のコードや設定を調べ、選択肢とおすすめの理由を説明する。目的、今回作る範囲、操作したときの動きを一つずつ相談する。
- この段階では話し合いを行う。仕様書へ残したくなったら、その旨を伝える。

```text
$openspec-explore
検証環境の口コミを本番へ反映したい。
まだ仕様を決める前なので、まず壁打ちしたい。
今の仕組みを調べたうえで、決める必要があることを一つずつ相談して。
専門用語を避けて説明してほしい。
```

### 2. 決まった内容を文書にする

- 話がまとまったら `openspec-propose` に、相談して決めた内容を文書にするよう頼む。
- 提案、仕様、設計、作業一覧が、`openspec/changes/<変更名>/` に作られる。
- `<変更名>` は今回の作業に付ける名前。次の例では `promote-preview-reviews` を使っている。
- 同じ作業の文書がすでにある場合は、次の「読んで確認し、必要なら直す」から進める。
- 文書ができたことと、その内容で実装すると決めたことは別。まず提案と仕様を読んで確認する。

```text
$openspec-propose promote-preview-reviews
ここまでの壁打ちで決めた内容を、提案・仕様・設計・作業一覧にまとめて。
```

### 3. 読んで確認し、必要なら直す

| 文書 | 書いてあること | 確認するポイント |
| --- | --- | --- |
| `proposal.md` | なぜ作るか、何を作るか | 自分が頼みたかった内容になっているか |
| `specs/<機能名>/spec.md` | 操作や条件ごとの動き | その動きで困らないか、抜けがないか |
| `design.md` | どう実装するか | 技術的な作り方を詳しく確認したいときに読む |
| `tasks.md` | 実装作業と確認方法 | 実装が始まってから、終わった作業を確認する |

- 分からない箇所は「この部分を説明して」と普通の言葉で聞いてよい。
- まだ考えがまとまっていなければ `openspec-explore` で壁打ちに戻る。
- 変える内容が決まったら `openspec-update-change` で関係する文書を揃えて直す。コードの実装は行わない。
- `WHEN` は「こうしたとき」、`THEN` は「こうなる」、`MUST` は「必ず守る決まり」と読む。
- OpenSpecの文書作成が「4/4完了」となっても、実装が終わったことにはならない。

```text
$openspec-update-change promote-preview-reviews
ここまでの相談で決め直した内容を、関係する文書に反映して。
```

### 4. 実装し、動作を確かめて記録する

1. 文書の内容に納得したら、`$openspec-apply-change promote-preview-reviews` のように対象を指定し、実装を頼む。
2. AIが作業一覧に沿ってコードを書き、必要なテストや動作確認を進める。実装の続きを頼む場合も同じスキルを使う。
3. 途中で仕様を考え直したくなったら、壁打ちや文書の修正に戻る。
4. 実装と動作確認が終わったら、`$openspec-archive-change promote-preview-reviews` で完成した内容を記録する。

- 完成時には、今回の仕様変更を、今のシステムの動きをまとめる `openspec/specs/` へ反映する。作業フォルダは `openspec/changes/archive/` へ移し、履歴として残す。
- OpenSpecでの完了記録と、本番サイトへの公開は別の作業。本番公開は [公開手順](docs/deploy-production.md) に従う。

## OpenSpecの6つのスキルの使い分け

| こんなとき | スキル | してくれること |
| --- | --- | --- |
| まず壁打ちしたい | `$openspec-explore` | 今の仕組みを調べ、選択肢を比べながら何を作るか相談する |
| 話した内容を文書にしたい | `$openspec-propose` | 提案・仕様・設計・作業一覧をまとめて作る |
| 作った仕様を直したい | `$openspec-update-change` | 決め直した内容を関係する文書へ揃えて反映する |
| 仕様に沿って実装したい | `$openspec-apply-change` | コードを書く。実装の続きを進めるときにも使う |
| 完成した変更を記録したい | `$openspec-archive-change` | 完成した内容を共通の仕様書へ反映し、今回の作業を履歴として整理する |
| 完了記録の前に、共通の仕様書だけ更新したい | `$openspec-sync-specs` | 今回の仕様変更を共通の仕様書へ反映する。作業フォルダは残す |

- 普段の流れは「壁打ち → 文書作成 → 内容確認 → 実装・動作確認 → 完了記録」。途中の相談と文書修正は、必要なだけ繰り返してよい。
- 通常は完了記録のときに共通の仕様書も更新する。`sync-specs` は、その更新を先に行いたいときに使う。

## OpenSpecの設定と進み具合の確認

### 文書の書き方を変えたいとき

- このリポジトリの前提や、OpenSpecで文書を書くときの指示は [openspec/config.yaml](openspec/config.yaml) に置く。
- 現在は、日本語で書くこと、日常の言葉で説明すること、必要な専門用語には説明を添えることを指定している。実装に必要なファイル名や設定名は、正確な名前を残す。
- [AGENTS.md](AGENTS.md) は、このリポジトリで作業するときの共通ルールと参照先をまとめたもの。OpenSpecの文章設定とは役割が異なる。

### ターミナルで確認したいとき

プロジェクトのフォルダで実行する。

```bash
npx openspec list
npx openspec status --change promote-preview-reviews
npx openspec validate promote-preview-reviews --strict
```

- `list` は作業中の変更一覧、`status` は文書の作成状況、`validate` は仕様書の書式などを確認する。
- これらの確認だけで、機能が正しく動くと判断しない。実装の完了は、作業一覧とテスト・動作確認の結果で確かめる。
- 例の変更名は、確認したい作業の名前に置き換える。

### 用語と困ったとき

| 用語 | 意味 |
| --- | --- |
| 壁打ち | 目的や選択肢を相談し、何を作るかを整理すること |
| 共通の仕様書 | `openspec/specs/` にある、今のシステムの動きをまとめた文書 |
| 完了記録（アーカイブ） | 完成した内容を仕様書へ反映し、作業フォルダを履歴として残すこと |

- 手順や文書が分からなくなったら、Codexのチャットで、分からない箇所を指定して説明を頼む。
- 詳しい動きは [OpenSpecの公式ガイド](https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md) と [壁打ちの公式ガイド](https://github.com/Fission-AI/OpenSpec/blob/main/docs/explore.md) を参照する。

## GitHub Issue・PRの運用

タイトル・本文の共通規則は[チケットの書き方](docs/rules/ticket-writing.md)に置く。この節ではGitHubでの登録・レビュー・完了操作を扱う。

### Issueの書き方

GitHub Issueのタイトルと本文にも、[チケットの書き方](docs/rules/ticket-writing.md)を適用する。

### 登録

- 既存Issueを検索し、同じ目的なら新規作成せず既存Issueを使用する
- 秘密情報・認証ヘッダー・顧客情報を含めない。未確認の原因を断定しない
- タイトルは `feat` / `fix` / `refactor` / `docs` / `test` / `chore` のいずれかで始め、`feat: 口コミの検索機能を追加` のように目的を具体的に示す。必要なら `scope` を付ける
- 原則として起票者にアサインする。担当者が決まっている場合はその人を指定する。CLI・APIからの登録でも同じ扱いとし、登録後にアサインを確認する
- 未実装や外部設定不足によるテスト失敗は、失敗を隠す変更を加えずIssueに記録する
- 登録後は内容を確認してURLを報告する。登録できなかった場合は本文を保存し、未登録と明記する

### 優先度

- 通常はラベルなし。必要な場合のみ `priority:urgent`（他の作業を中断）または `priority:next`（次に着手）を最大1つ付ける
- 優先度を付ける場合は、影響・期限・作業の妨げなどの理由を本文に1行記載する
- 本番のサービス提供に支障が出た場合だけ、別途 `incident` を付ける

### 作業の分割と完了

- 小さな作業はチェックリストで管理する。個別に実装・検証・完了を追跡する必要がある場合だけ子Issueに分割する
- 分割時はGitHubのSub-issue機能で主な親を1つ設定し、親→子の2段階までとする。本文リンクだけで紐付け完了とは扱わない
- 分割した作業の優先度は子Issueに付ける。親は完了を判断できる範囲に区切る
- 完了条件を検証し、結果をIssueに残してから完了する。親は対象の子Issueとテーマ全体の完了条件が満たされたら完了する

### Pull Request

- PRは原則として作成者自身にアサインする。担当者を明示された場合はその人を指定する。`gh pr create` では `--assignee @me` を使い、作成後にアサインを確認する。VS Codeでは `githubPullRequests.assignCreated` に `${user}` を設定する
- ブランチは [命名規則](docs/rules/branch-naming.md) に従って最新の `main` から作成し、PRの取り込み先も `main` とする。長期運用ブランチは `main` の1つとする
- 1つのPRは1つの目的に絞る。無関係な変更は別のPRに分ける
- タイトル・本文の作成と自動生成は [PR生成規則](.github/instructions/pull-request.instructions.md) に従い、日本語で記載する
- 作成後に取り込み先・差分・本文を確認し、URLを報告する。作成できなかった場合は本文を保存し、未作成と明記する
- マージ前に差分をレビューし、必要な検証の成功と指摘の解消を確認する。PR作成の依頼だけでマージせず、マージの依頼または事前の合意に従う
- マージ前にIssueの完了条件を確認し、検証結果とPRリンクをIssueへ記録する。`Closes` を記載したIssueはmainへのマージ時にGitHub標準機能で自動完了する。本番確認が必要なIssueは、その確認まで `Refs` として残す
- マージ後は作業ブランチを削除する

テンプレートの自動表示にはデフォルトブランチへの反映が必要。

### プロジェクト固有の手順

リリース時の共通の確認事項は[AGENTS.md](AGENTS.md)の「リリース」に従う。ビルド・検証・リリースの具体的な手順は、導入先プロジェクトの文書で管理する。

### 参考資料

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)：ブランチ、PR、レビュー、マージの基本的な流れ。
- [GitHubのIssueとPRの関連付け](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)：関連付けと、終了キーワードによるIssueの自動完了。
- [GitHubのSub-issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)：Issueを親子関係で管理する機能。
- [GitHubのPRテンプレート](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)：テンプレートの配置と自動表示。

担当者の原則、優先度ラベル、親子を2段階までとする制限、マージ前の確認手順は、このリポジトリの運用規則とする。
