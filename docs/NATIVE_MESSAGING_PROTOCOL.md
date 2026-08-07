# Native Messaging Protocol (Step 1 Fixed)

この文書は、Issue #46 のステップ1として Time Is Money の Native Messaging Host 入出力仕様を固定するための基準です。

## 1. スコープ

- 対象: Chrome Extension (`sendNativeMessage`) と Native Messaging Host 間の通信
- 対象外: Host から Tauri への内部連携方式、タイマー画面の反映ロジック

## 2. ホスト名とチャネル

- Host 名: `com.timeismoney.app`
- 通信方向:
  - 入力: Chrome -> Host (`stdin`)
  - 出力: Host -> Chrome (`stdout`)
  - ログ: Host -> `stderr`

## 3. フレーミング仕様

Native Messaging の標準仕様に従い、メッセージは次の形式で送受信する。

1. 先頭 4 バイト: メッセージ長 (unsigned 32-bit, little-endian)
2. 続く N バイト: UTF-8 JSON 文字列

### 実装ルール

- `stdout` には上記フレーム以外を書かない
- デバッグ・エラーログは `stderr` のみ
- 不完全フレームを受けた場合はエラー応答を返し、必要なら処理を終了する

## 4. 入力メッセージ仕様 (Chrome -> Host)

### 4.1 URL変更

```json
{
  "type": "URL_CHANGE",
  "url": "https://docs.google.com/document/d/example",
  "timestamp": 1704067200000
}
```

### 4.2 計測停止

Chromeが非アクティブになった場合やHTTP/HTTPS以外へ移動した場合に送信する。

```json
{
  "type": "TRACKING_STOP",
  "timestamp": 1704067200000
}
```

### 4.3 バリデーション

- `type`
  - 必須、文字列
  - `URL_CHANGE`または`TRACKING_STOP`
- `url`
  - `URL_CHANGE`では必須、`TRACKING_STOP`では指定しない
  - `http` / `https` のみ許可
  - 受信後に再サニタイズする
    - query を除去
    - hash を除去
    - username/password を除去
- `timestamp`
  - 必須、数値 (Unix epoch milliseconds)

## 5. 出力メッセージ仕様 (Host -> Chrome)

### 5.1 成功レスポンス

```json
{
  "success": true,
  "code": "OK",
  "message": "URL accepted",
  "sanitizedUrl": "https://docs.google.com/document/d/example"
}
```

`TRACKING_STOP`成功時は`sanitizedUrl`を返さない。

### 5.2 失敗レスポンス

```json
{
  "success": false,
  "code": "INVALID_URL",
  "message": "Only HTTP/HTTPS URLs are allowed"
}
```

### 5.3 `code` 一覧

- `OK`: 正常受理
- `INVALID_JSON`: JSON 解析失敗
- `INVALID_MESSAGE_TYPE`: 未知の `type`
- `INVALID_URL`: URL 不正、または許可されない scheme
- `MESSAGE_TOO_LARGE`: サイズ上限超過
- `APP_UNAVAILABLE`: アプリ連携先へ送信できない
- `INTERNAL_ERROR`: 想定外エラー

## 6. サイズ制限

- 受信メッセージ最大サイズ: 256 KiB
- 送信メッセージ最大サイズ: 256 KiB

上限超過時は `MESSAGE_TOO_LARGE` を返す。

## 7. ログ方針

- `stdout`: Native Messaging フレーム化された JSON 応答のみ
- `stderr`: デバッグ/障害調査用ログ
- ログに含めない情報:
  - サニタイズ前 URL の query
  - hash
  - username/password

## 8. 互換性ポリシー

- 本仕様は `v1` として扱う
- 将来フィールド追加する場合は後方互換を維持する
- `type` の追加は Host 側で明示対応する

## 9. 実装完了判定 (Step 1)

- 送受信フレーム形式が文書化されている
- 入出力 JSON 契約が文書化されている
- `stdout`/`stderr` 分離ルールが明確化されている
- URL バリデーション・サニタイズ要件が固定されている
