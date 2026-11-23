# EmDashの空欄編集の補正

`emdash+1.3.1.patch` は、本文が `null` または未設定のとき、インライン編集が管理画面へ移動してしまう問題を修正する。
本文を取得できた場合に限り、空の保存値と空の表示を同じものとして扱う。取得失敗を空欄とみなさない。

`npm install` / `npm ci` の後に `patch-package --error-on-fail` で適用する。ソースと配布用バンドルの両方を含む。
EmDash更新時は `tests/emdash-inline-empty-body.test.ts` とブラウザで空の本文の入力・保存を確認し、公式で修正済みならパッチを削除する。
