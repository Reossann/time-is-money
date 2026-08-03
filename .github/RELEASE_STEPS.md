# Release 手順

## 1. 変更をコミットする

```bash
git add .
git commit -m "Prepare release"
```

## 2. タグを打つ

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 3. GitHub Actions で実行する

- GitHub のリポジトリで Actions タブを開く
- Release ワークフローを選ぶ
- Run workflow を押す

## 4. 完了後に確認する

- Actions の実行ログを確認する
- GitHub Release に成果物が添付されているか確認する
- Artifacts に Windows ビルド成果物が保存されているか確認する
