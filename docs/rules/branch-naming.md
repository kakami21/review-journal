# ブランチ命名規則

最新の `main` から、1つの目的につき1つのブランチを作成する。名前は次の形式とし、`codex/` 接頭辞は付けない。

```text
<type>/<ticket-id>-<topic>
```

## type

- `feat`: 機能追加
- `fix`: 不具合修正
- `refactor`: 動作を変えない設計改善
- `docs`: 文書のみ
- `test`: テストのみ
- `chore`: 依存関係・設定・保守作業

## ticket-id

- 対応するチケットのIDを記載する。GitHub Issueでは番号、Azure DevOpsでは作業項目IDを使い、`#`は付けない
- 複数のチケットに関係する場合は、主なもののIDを1つ使う
- チケットがない場合は、IDを推測せず `<type>/<topic>` とする

## topic

- 英小文字のケバブケースで変更目的を短く表す
- 人名、日付、`update` や `work` だけの曖昧な名前は使わない

例：

```text
refactor/8-astro-pages-api
chore/7-astro-development
docs/6-emdash-architecture
```

マージ後はブランチを削除する。

## 参考資料

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)：目的ごとのブランチ作成、PRによるレビュー・マージ、作業後のブランチ削除。
- [Git check-ref-format](https://git-scm.com/docs/git-check-ref-format)：Gitで使用できるブランチ名の制約。

`<type>/<ticket-id>-<topic>`の形式、typeの一覧、ケバブケース、`codex/`を付けない方針は、このリポジトリ独自の命名規則とする。
