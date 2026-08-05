# Time Is Money

Windows向けのデスクトップアプリとして、PC作業中に使った時間を金額換算して見える化するための初期雛形です。

現在はまだ開発の土台だけを用意しており、監視処理、データ保存、通知、自動起動、集計などの本体機能は未実装です。

## 現在入っているもの

- Tauri v2 + React + TypeScript + Vite の初期構成
- Dashboard / History / Rules / Settings の最低限の画面
- 最低限のサイドバーによる画面切り替え
- 将来使う型定義と Zod スキーマの雛形
- Rust 側の空モジュール構成
- 仕様書: [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md)

## 未実装のもの

- 前面ウィンドウ取得
- 利用時間の自動計測
- SQLite への保存
- 通知
- 自動起動
- システムトレイ
- ブラウザ拡張機能連携
- 日別・週別・月別集計

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
