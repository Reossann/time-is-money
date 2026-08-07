# Time Is Money

Windows向けのデスクトップアプリとして、PC作業中に使った時間を金額換算して見える化するために開発中のアプリです。

現在は、4画面のUI、アプリ起動からの経過時間表示、自動起動設定、通知の動作確認、システムトレイ、前面ウィンドウ情報の単発取得まで実装済みです。

前面ウィンドウの実行ファイル名・タイトル・PIDは、Windows API、Tauri Command、Zodによる型・値検証付きフロントサービスを通して1回分取得できます。継続監視、アプリ別の時間計測、保存、分類、タイマー画面への表示にはまだ接続していません。

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
- 仕様書: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

## 未実装のもの

- 前面ウィンドウの継続監視とアプリ別利用時間の計測
- ウィンドウ切り替えの検知と活動レコードの作成
- SQLite への保存
- 分類ルールの作成・適用
- カレンダーへの活動履歴表示
- 実際の利用時間・設定値に基づく通知
- ブラウザ拡張機能連携
- 金額換算、グラフ、日別・週別・月別集計

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
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --all-features
```

Rustの単体テストは対象モジュール内へ`#[cfg(test)] mod tests`として追加します。

## Release

新しいアプリバージョンの更新、検証、Pull Request、タグ作成、GitHub Release確認は、[Release手順](.github/RELEASE_STEPS.md)に従ってください。設定値の更新漏れは`npm run version:check`で確認できます。

詳細な設計方針と実装予定は [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) を参照してください。
