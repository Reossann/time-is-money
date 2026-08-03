# GitHub Actions セットアップメモ

## 1. 追加したもの

- CI ワークフロー: .github/workflows/ci.yml
- Release ワークフロー: .github/workflows/release.yml

## 2. 使い方

CIの`frontend-check`とReleaseの`build-windows`は、どちらもNode.js 24を使用します。

### CI

- main または master へ push されたとき
- main または master を対象にした pull request 作成時

自動で以下を実行します。

frontend-check:

- npm ci
- npm run lint
- npm run typecheck
- npm test
- npm run build

rust-check:

- cargo fmt --check
- cargo clippy --all-targets --all-features -- -D warnings
- cargo test --all-targets --all-features
- cargo check

### Release

- v\* 形式のタグを push すると実行されます。
- GitHub Release を自動生成します。

## 3. 次に必要な準備

1. GitHub リポジトリで Actions を有効化する
2. main/master ブランチで CI が動くことを確認する
3. タグ付きリリースを試す

## 4. Tauri アプリを本格的に CI に乗せる場合

将来的には以下も追加するとよいです。

- Tauri の macOS / Windows / Linux 向けビルド
- signing / artifact upload
