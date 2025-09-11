# 推奨コマンド

## 開発コマンド

- `bun run build` - TypeScriptをビルドしてdist/に出力
- `bun run dev` - watchモードでビルド（開発時）
- `bun run test` - Biomeでコードチェック
- `bun run lint` - Biomeで自動修正付きリント

## Biome関連

- `biome check .` - リントチェック
- `biome check . --write` - 自動修正付きリント
- `biome format . --write` - フォーマット

## Git関連（プロジェクト固有）

- `git switch -c riya-amemiya/<branch-name>` - 新しいブランチ作成・切り替え

## ファイルシステム操作（Darwin）

- `ls -la` - ファイル一覧（隠しファイル含む）
- `find . -name "*.ts" -o -name "*.tsx"` - TypeScriptファイル検索
- `grep -r "pattern" src/` - ソースディレクトリ内検索

## パッケージ管理

現在はBunのロックファイルがあるが、scriptsはbun基準で記述されている。

- `bun install` - 依存関係インストール
- `bun install` - bunでのインストール

## 実行・テスト

- `node dist/cli.js` - ビルド後の実行
- `bun run src/cli.tsx` - 直接実行（開発時）
