# Time Is Money - Web Tracker

Chrome拡張機能で、開いているウェブアプリの URL を自動取得し、Time Is Money デスクトップアプリに送信します。

## ファイル構成

```
extensions/webtime-tracker/
├── manifest.json          # Chrome拡張機能の設定ファイル
├── README.md             # このファイル
└── src/
    ├── icons/            # Chrome拡張機能用アイコン
    │   ├── icon-16.png
    │   ├── icon-32.png
    │   ├── icon-48.png
    │   └── icon-128.png
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
- **ポップアップ UI**: 計測状況を表示
- **接続状態表示**: Host未登録、アプリ未起動、送信失敗を成功扱いせず表示

## インストール方法

### 開発モード

1. プロジェクトルートで `npm run tauri dev` を実行する
2. `chrome://extensions/` にアクセス
3. **デベロッパーモード** を有効化（右上）
4. **パッケージ化されていない拡張機能を読み込む** をクリック
5. `extensions/webtime-tracker/` フォルダを選択
6. 拡張機能IDが `cdoabncafaeaijdgbjioennfmebpgcih` であることを確認する

`npm run tauri dev`はNative Messaging Hostをビルドし、アプリ起動時に現在のWindowsユーザーへHostを登録します。自動登録に失敗した場合のみ、アプリを終了してから次を実行します。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-native-messaging-dev.ps1
```

### リリース版

（未実装）

## 権限

- `tabs`: アクティブなタブを取得
- `nativeMessaging`: Tauri アプリと通信
- `storage`: Service Workerの再起動後も直前のURLを保持
- `alarms`: アプリ再起動後も現在URLを再同期するため、30秒ごとに接続を確認

取得対象はHTTP/HTTPSのみです。送信前にURLのクエリ文字列とハッシュを除去します。

## 通信仕様

Native Messaging の正式仕様は `docs/NATIVE_MESSAGING_PROTOCOL.md` を参照してください。

この README では概要のみ記載します。

### URL 送信（拡張機能 → Tauri）

```json
{
  "type": "URL_CHANGE",
  "url": "https://docs.google.com/document/d/...",
  "timestamp": 1704067200000
}
```

補足:

- 送信対象は HTTP/HTTPS のみ
- query / hash / 認証情報は除去して送信

Chromeが非アクティブになった場合は、現在のセッションを終了するため`TRACKING_STOP`を送信します。

```json
{
  "type": "TRACKING_STOP",
  "timestamp": 1704067200000
}
```

### レスポンス（Tauri → 拡張機能）

```json
{
  "success": true,
  "code": "OK",
  "message": "URL accepted",
  "sanitizedUrl": "https://docs.google.com/document/d/example"
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
  - 拡張機能IDが `cdoabncafaeaijdgbjioennfmebpgcih` か
  - ポップアップに「Native Host未登録」「Time Is Moneyが未起動」が出ていないか

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
