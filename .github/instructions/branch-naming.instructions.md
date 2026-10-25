# ブランチ命名規則

`develop` から、1つの目的につき1つのブランチを作成する。名前は次の形式とし、`codex/` 接頭辞は付けない。

```text
<type>/<topic>
```

## type

- `feat`: 機能追加
- `fix`: 不具合修正
- `refactor`: 動作を変えない設計改善
- `docs`: 文書のみ
- `test`: テストのみ
- `chore`: 依存関係・設定・保守作業

## topic

- 英小文字のケバブケースで変更目的を短く表す
- 人名、日付、`update` や `work` だけの曖昧な名前は使わない

例：

```text
feat/review-search
fix/duplicate-reviews
docs/emdash-architecture
```

マージ後はブランチを削除する。
