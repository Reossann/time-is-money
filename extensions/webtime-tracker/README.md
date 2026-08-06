# Time Is Money - Web Tracker

Chrome拡張機能で、開いているウェブアプリの URL を自動取得し、Time Is Money デスクトップアプリに送信します。

## ファイル構成

```
extensions/webtime-tracker/
├── manifest.json          # Chrome拡張機能の設定ファイル
├── README.md             # このファイル
└── src/
    ├── background.js     # Service Worker（タブ監視、URL送信）
    ├── tracking-utils.js # URLの正規化、重複排除、アプリ判定
    ├── popup.html        # ポップアップUI
    ├── popup.js          # ポップアップロジック
    └── popup.css         # ポップアップスタイル
```

## 機能

- **自動 URL 監視**: アクティブなタブの URL を定期的に取得
- **タブ切り替わり検出**: ユーザーがタブを切り替わったときに新しい URL を送信
- **Native Messaging**: Tauri デスクトップアプリと通信
- **ポップアップ UI**: 現在のウェブアプリと計測状況を表示

## インストール方法

### 開発モード

1. `chrome://extensions/` にアクセス
2. **デベロッパーモード** を有効化（右上）
3. **パッケージ化されていない拡張機能を読み込む** をクリック
4. `extensions/webtime-tracker/` フォルダを選択

### リリース版

（未実装）

## 権限

- `tabs`: アクティブなタブを取得
- `nativeMessaging`: Tauri アプリと通信
- `storage`: Service Workerの再起動後も直前のURLを保持

取得対象はHTTP/HTTPSのみです。送信前にURLのクエリ文字列とハッシュを除去します。

## 通信仕様

### URL 送信（拡張機能 → Tauri）

```json
{
  "type": "URL_CHANGE",
  "url": "https://docs.google.com/document/d/...",
  "timestamp": 1704067200000
}
```

### レスポンス（Tauri → 拡張機能）

```json
{
  "success": true,
  "message": "URLを受け取りました: https://...",
  "webAppId": "google-docs",
  "webAppName": "Google Docs"
}
```

## トラブルシューティング

### ウェブアプリが検出されない

- **確認事項**:
  - 拡張機能が有効化されているか
  - `chrome://extensions/` で「Time Is Money - Web Tracker」が表示されているか
  - DevTools（F12） → Console でエラーがないか

### Tauri との通信に失敗

- **確認事項**:
  - Tauri アプリが起動しているか
  - ネイティブメッセージングホスト設定が正しいか

## 開発

### ファイル変更後

Chrome を再読み込み（`chrome://extensions/` ページのリロードボタン）

### デバッグ

DevTools で以下を確認：

```
chrome://extensions/
↓
Time Is Money - Web Tracker の詳細
↓
Service Worker を検査 → Console でログ確認
```
