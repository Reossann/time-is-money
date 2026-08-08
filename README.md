# Time Is Money

Windows向けのデスクトップアプリとして、PC作業中に使った時間を金額換算して見える化するために開発中のアプリです。

現在は、4画面のUI、アプリ起動からの経過時間表示、自動起動設定、通知の動作確認、システムトレイ、前面Windowsアプリ別の利用時間計測、Chrome拡張機能とのNative Messaging連携まで実装済みです。

タイマーsessionの開始と同時にRustの常駐workerが前面process名だけを継続観測し、アプリ別の利用時間snapshotを返します。開発時はタイマー画面のdiagnosticsで確認できますが、結果UI・金額換算・履歴保存にはまだ接続していません。

## 現在入っているもの

- Tauri v2 + React + TypeScript + Vite の初期構成
- タイマー / カレンダー / グラフ / 設定の画面とサイドバーによる切り替え
- タイマー画面でのアプリ起動からの経過時間表示
- 設定画面での自動起動設定と時給設定
- 閉じる操作で非表示になり、再表示・終了を選べるシステムトレイ
- 起動5秒後にランダム表示する開発用の仮通知
- Rust / TypeScript間で共有する型定義とZodスキーマ
- Windows APIによる前面ウィンドウ情報の単発取得
- 前面ウィンドウ取得用のTauri Commandとフロントサービス
- Rust常駐workerによる前面Windowsアプリの1秒samplingと、timer session単位の利用時間集計
- session ID / startedAt / endedAtを共有するstart・snapshot・stop Commandと、Zod検証済みの公開snapshot
- 開発時だけ表示するアプリ別利用時間diagnostics。トレイへ隠した後も計測は継続
- Chrome拡張機能、Native Messaging Host、Tauriを通したChromeのサイト（ドメイン）別利用時間計測
- 仕様書: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

## 未実装のもの

- ウィンドウ切り替えの検知と活動レコードの作成
- SQLite への保存
- 分類ルールの作成・適用
- カレンダーへの活動履歴表示
- 実際の利用時間・設定値に基づく通知
- 金額換算、グラフ、日別・週別・月別集計

## アプリ別利用時間計測の範囲

- 内部ではmillisecondsで集計し、公開snapshotでは完了した秒数だけを返します。`tracked + untracked = total`を保ちます。
- 1秒ごとに前面processを観測し、前のprocessへ区間を割り当てます。5秒を超える観測gapは直前アプリへ加算せず、全体を未追跡にします。sampling方式のため、切り替え時刻の完全一致は保証しません。
- Time Is Money自身、前面windowなし、Windows API失敗、不正なprocess名、1秒未満で公開されない端数は未追跡です。アイドル判定とlock/unlock検出は未実装です。
- Chromeなどのbrowserはdesktop process一件としてだけ計測します。Chrome拡張のURL eventや`useWebAppStore`とは統合せず、二重計上しません。
- snapshot、error、diagnostics、ログにはwindow title、URL、PID、full pathを含めません。URL受信CommandもURL本体を返却・出力しません。
- 利用時間snapshotはメモリ上のみで、SQLiteやTauri Storeへ保存しません。#32などの後続consumerは`stopAndSnapshotAppUsage()`で固定済みの`endedAt`に対応するsnapshotを取得します。

## 使用技術

- Tauri v2
- React
- TypeScript
- Vite
- Rust
- SQLite は将来導入予定
- Zustand
- Zod

## 事前準備

このプロジェクトを別の開発環境で始める場合は、まず次の開発環境を入れてください。

- Node.js 24（LTS）
- npm
- Rust
- Cargo
- Microsoft C++ Build Tools
- WebView2
- Git

インストール後は、次のコマンドで確認できます。

```bash
node -v
npm -v
rustc --version
cargo --version
git --version
```

`node -v`が`v24.x`で始まることを確認してください。

準備ができたら、リポジトリを取得して依存関係を入れます。

```bash
git clone <repository-url>
cd <project-directory>
npm install
```

起動時は、用途に応じて次のコマンドを使います。

```bash
npm run dev
npm run tauri dev
```

## セットアップ

```bash
npm install
```

## 起動コマンド

```bash
npm run dev
npm run tauri dev
```

## ビルドコマンド

```bash
npm run build
npm run tauri build
```

## テスト

フロントエンドのテストを1回実行します。

```bash
npm test
```

開発中にファイル変更を監視しながら実行する場合は、次のコマンドを使います。

```bash
npm run test:watch
```

フロントエンドのテストは対象コードの近くへ`*.test.ts`または`*.test.tsx`として追加します。ReactコンポーネントはReact Testing Libraryで描画し、ユーザーが確認できる役割や表示名を使って検証します。

Rustのテストを実行します。

```bash
npm run test:rust
```

Rustの単体テストは対象モジュール内へ`#[cfg(test)] mod tests`として追加します。

## セッション結果（version 1）

タイマーを停止すると、停止時刻を固定した1つの`SessionResult`を確定できます。結果にはsession ID、開始・終了時刻、tracked / untracked時間、アプリ別の利用時間、適用時給、分類、獲得・浪費・差額の整数円を含みます。表示処理と将来の保存処理は、同じ確定済みobjectを読む前提です。

現在の分類sourceは未接続です。そのため実運用では未分類アプリを`null`として保持し、金額は0円になります。`productive`、`waste`、`neutral`の金額ルールはcontractとtestで定義済みですが、分類を付与するUIや永続化はまだありません。

開発時だけタイマーページに結果診断パネルが表示されます。停止・再試行と、アプリ名、時間、分類、時給、金額を確認できます。本番buildにはこの入口を含めません。window title、URL、PID、full path、raw errorは結果・診断・ログへ出しません。

未実装: 結果画面、SQLite保存、累計・同期、分類source / 分類UI。本番の停止ボタンや結果表示は別Issueで接続します。

## Release

新しいアプリバージョンの更新、検証、Pull Request、タグ作成、GitHub Release確認は、[Release手順](.github/RELEASE_STEPS.md)に従ってください。設定値の更新漏れは`npm run version:check`で確認できます。

詳細な設計方針と実装予定は [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) を参照してください。
