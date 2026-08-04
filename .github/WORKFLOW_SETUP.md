# GitHub Actions セットアップメモ

## 1. ワークフロー

- CI: `.github/workflows/ci.yml`
- Windows Release: `.github/workflows/release.yml`
- 正規の公開手順: `.github/RELEASE_STEPS.md`

CIの`frontend-check`とReleaseの`build-windows`は、どちらもNode.js 24を使用する。

## 2. CI

CIは、mainまたはmasterへのpushと、それらを対象にしたPull Requestで実行される。

`frontend-check`の実行内容:

- `npm ci`
- `npm run version:check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

`rust-check`の実行内容:

- `cargo fmt --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --all-targets --all-features`
- `cargo check`

`npm run version:check`は次の6つの値を比較する。

1. `package.json#version`
2. `package-lock.json#version`
3. `package-lock.json#packages[""]#version`
4. `src-tauri/Cargo.toml`の`[package].version`
5. `src-tauri/Cargo.lock`内の`time-is-money` package version
6. `src-tauri/tauri.conf.json#version`

1つでも異なる場合は、検出した値を表示して`frontend-check`を失敗させる。

## 3. Release

Releaseワークフローは`v*`形式のGitタグがpushされたときだけ実行される。タグを伴わない手動実行経路は用意していない。

`build-windows`は次の順序で処理する。

1. リポジトリをcheckoutする
2. Node.js 24とRustを準備する
3. `npm ci`で依存関係を復元する
4. `npm run version:check -- --tag "${{ github.ref_name }}"`で6つの設定値とタグを比較する
5. フロントエンドをbuildする
6. Tauri Windowsアプリをbuildし、GitHub Releaseとworkflow artifactへアップロードする

タグは厳密に`v<設定バージョン>`と一致する必要がある。例えば設定が`0.1.5`なら`v0.1.5`だけが成功し、`v0.1.6`はReleaseのbuild前に失敗する。`release-0.1.5`は`v*`に一致しないため、Releaseワークフロー自体が開始しない。

Release資産名とworkflow artifact名には、Tauri設定から取得した`[version]`が含まれる。これにより、タグ名だけでなく成果物名からもアプリバージョンを確認できる。

## 4. リポジトリ側で確認すること

1. GitHub Actionsが有効になっている
2. Pull Requestで`frontend-check`と`rust-check`が成功している
3. Release用タグを作成する前にPull Requestがmainへマージされている
4. タグpush後に`Release / build-windows`が成功している
5. Release資産名とworkflow artifact名に対象バージョンが含まれている

新しいバージョンを公開するときは、必ず[Release手順](RELEASE_STEPS.md)に従う。

## 5. 現在の対象範囲

- Release buildはWindowsのみ
- コード署名と自動更新は未設定
- macOS・Linux向けReleaseは未設定
