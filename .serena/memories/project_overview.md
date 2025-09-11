# Auto Rebase CLI Project Overview

## プロジェクトの目的

GitHub ActionsのAuto Rebase PR機能をCLIツールに落とし込むプロジェクトです。現在はcreate-ink-appで作成されたテンプレート状態で、実際の機能はまだ実装されていません。

## 技術スタック

- **フレームワーク**: Ink (React for CLI)
- **言語**: TypeScript
- **パッケージマネージャー**: Bun (bun.lockがある)
- **ランタイム**: Node.js >= 16
- **リンター・フォーマッター**: Biome 2.2.4
- **テスティング**: Ava (devDependency)
- **CLIパーサー**: meow

## 現在の構造

```tree
/
├── src/
│   ├── app.tsx    (メインReactコンポーネント)
│   └── cli.tsx    (CLIエントリーポイント)
├── package.json
├── tsconfig.json
├── biome.json
└── dist/         (ビルド出力)
```

## ビルドとエントリーポイント

- エントリーポイント: `dist/cli.js`
- ビルドコマンド: `bun run build` (tsc)
- 開発コマンド: `bun run dev` (tsc --watch)

## 実装すべき機能

GitHub ActionsのAuto Rebase PRワークフローをCLI化:

1. PRのコメントを監視する代わりに、CLI引数でリベース対象を指定
2. GitHub API経由でPR情報を取得
3. Gitコマンドでリベース実行
4. PR更新とコメント投稿
