# Release 手順

この手順では、公開済みタグを変更せず、新しいバージョンの設定変更をmainへマージしてから新規タグを作成する。

以下は`0.1.5`を公開する場合の例である。次回以降は、すべての`0.1.5`と`v0.1.5`を新しいバージョンへ読み替える。

## 1. 開始前に確認する

作業ツリーがクリーンな最新mainから、バージョン更新用のブランチを作る。

```bash
git status --short
git switch main
git pull --ff-only origin main
git fetch --tags origin
git tag --list v0.1.5
git switch -c release/v0.1.5
```

`git tag --list v0.1.5`が何も表示しないことを確認する。既に存在するタグは再利用せず、別の未使用バージョンを選ぶ。

## 2. 5ファイルのバージョンを更新する

最初にnpm packageとlockfileを更新する。

```bash
npm version 0.1.5 --no-git-tag-version
```

続いて、次の2か所を`0.1.5`へ変更する。

- `src-tauri/Cargo.toml`の`[package].version`
- `src-tauri/tauri.conf.json`の`version`

Cargo lockfileへ自プロジェクトのバージョンを反映する。

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

更新対象は次の5ファイルである。

- `package.json`
- `package-lock.json`のトップレベルと`packages[""]`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`内の`time-is-money` package
- `src-tauri/tauri.conf.json`

## 3. バージョンとアプリを検証する

設定値同士と、作成予定のタグが一致することを確認する。

```bash
npm ci
npm run version:check
npm run version:check -- --tag v0.1.5
npm run lint
npm run typecheck
npm test
npm run build

cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --all-targets --all-features
cargo check --manifest-path src-tauri/Cargo.toml
```

`version:check`が失敗した場合はタグを作らず、表示されたファイルの値を修正してから再実行する。

## 4. バージョン変更をコミットしてPull Requestをマージする

意図した5ファイルだけをステージする。

```bash
git diff --check
git status --short
git add -- package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "chore: アプリバージョンを0.1.5に更新する"
git push -u origin release/v0.1.5
```

Pull Requestを作成し、`frontend-check`と`rust-check`が成功したことを確認してmainへマージする。タグはPull Requestのブランチには作成しない。

## 5. マージ済みmainを最終確認する

```bash
git switch main
git pull --ff-only origin main
npm ci
npm run version:check -- --tag v0.1.5
git status --short
git log -1 --oneline
```

作業ツリーがクリーンで、表示されたmainの最新コミットが公開対象であることを確認する。

## 6. 新しいタグを作成してpushする

タグ作成とpushはReleaseを開始する外部操作である。対象バージョンとコミットを再確認し、リポジトリ所有者の承認後に実行する。

```bash
git tag v0.1.5
git show --no-patch --oneline v0.1.5
git push origin v0.1.5
```

公開済みタグを`--force`で移動・上書きしてはいけない。誤りが見つかった場合は、新しいpatchバージョンで修正する。

`v*`タグのpushによりReleaseワークフローが自動で開始する。Actions画面から追加で手動実行する必要はない。

## 7. Release完了を確認する

- Actionsの`Release / build-windows`が成功している
- GitタグとGitHub Release名が`v0.1.5`で一致している
- Release資産名とworkflow artifact名に`0.1.5`が含まれている
- Windows成果物を起動でき、実行ファイルの`ProductVersion`へ`0.1.5`が反映されている
- Releaseが設定更新を含むmainのコミットを指している
- 過去のタグとReleaseが変更されていない
