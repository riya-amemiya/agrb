# タスク完了時のワークフロー

## 実装完了後に実行すべきコマンド

### 必須チェック

1. **リント・フォーマット**: `bun run lint`
2. **型チェック**: `bun run build`（tscでビルドできることを確認）
3. **テスト**: `bun run test`

### 推奨チェック

- **ビルド確認**: `bun run build && node dist/cli.js --help`
- **開発モード**: `bun run dev`で正常にwatchできるか

### コミット前

- **ステージング**: 変更ファイルをgit add
- **コミットメッセージ**: [Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/)形式
  - 例: `feat: implement auto rebase CLI functionality`
  - 例: `fix(git): handle merge conflicts in rebase`

### ブランチ作成規則

- `git switch -c riya-amemiya/<branch-name>`
- releaseブランチは本番デプロイ用のため使用禁止

### エラー対応

Biomeでエラーが出た場合:

- `biome check . --write`で自動修正を試行
- 手動修正が必要な場合は、biome.jsonの設定確認
