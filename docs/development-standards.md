# 共有ルールの運用

原本は[development-standards](https://github.com/kakami21/development-standards)で管理する。
導入元はdevelopment-standardsのコミット`1fc6dda`。原本の設計方針は[README](https://github.com/kakami21/development-standards#設計思想)を参照する。同期コマンドは原本側にあり、このリポジトリへのコピーは不要。

## 導入・更新

Node.js 22以降とGitを使用する。共通リポジトリ側で初回に`npm ci`を実行する。
共通リポジトリを取得・更新した後、table-notesのルートから実行する。
以下は両リポジトリを同じ親フォルダに配置した場合の例。

```sh
# 変更予定を確認する
node ../development-standards/scripts/sync.mjs .

# 反映する
node ../development-standards/scripts/sync.mjs . --write

# 差分と、再実行時の変更が0件であることを確認する
git diff
node ../development-standards/scripts/sync.mjs .
```

共通ルールの変更は原本側で行い、このリポジトリへ同期する。
`AGENTS.md`と`.github/copilot-instructions.md`では管理マーカー内が同期対象。
プロジェクト固有の指示は`AGENTS.md`のマーカー外に記載する。Copilot用案内は`AGENTS.md`への参照だけとする。
エージェント向けの本文は`docs/rules/`、生成ボタン向けは`.github/instructions/`に分ける。
生成ボタンは`.vscode/settings.json`の2項目で原本を直接参照し、他のエディター設定は保持する。
その他の配布ファイルは原本で上書きされる。移動済みの旧3ファイルは本文一致を確認して削除する。

## プロジェクト固有の規則

リリースの共通規則は[共通リリース規則](rules/release.md)で管理する。
本プロジェクトの公開先・Secrets設定・CI・復旧などの具体的な手順は[リリース手順](releases.md)に保持する。
`.github/workflows/`のCI・公開設定はこのプロジェクトで管理し、今回の同期対象には含まれない。

## 読み込みの確認範囲

ローカルでは配布ファイルの原本一致、相対リンク先、既存規則の保持、再同期時の変更0件を確認できる。
Copilotが実際に採用した指示は、利用環境の参照一覧で確認する。
GitHubのIssue・PRテンプレートの画面表示には、デフォルトブランチへの反映が必要。
