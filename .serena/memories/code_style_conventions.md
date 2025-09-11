# コードスタイル・規約

## TypeScript設定

- `@sindresorhus/tsconfig`を継承
- JSX: react-jsx
- 出力ディレクトリ: `dist/`
- ソースディレクトリ: `src/`

## Biome設定による規約

- **インデント**: タブ（indentStyle: "tab"）
- **クォート**: ダブルクォート（quoteStyle: "double"）
- **改行**: LF
- **インポート**: 自動整理有効

## 有効なリントルール

- recommended: true（推奨ルール全般）
- style:
  - noEnum: error（enum禁止）
  - noUselessElse: error（不要なelse禁止）
  - useBlockStatements: error（ブロック文必須）
  - useCollapsedElseIf: error（else-if統合）
  - useCollapsedIf: error（if統合）
- suspicious:
  - noEvolvingTypes: error（型変化禁止）
  - noVar: error（var禁止）
- complexity:
  - useSimplifiedLogicExpression: error（論理式簡素化）

## ファイル命名規則

現在のファイル構造から推測:

- CLIエントリーポイント: `cli.tsx`
- メインコンポーネント: `app.tsx`
- 拡張子: `.tsx`（JSXを含む場合）、`.ts`（通常のTS）

## インポート規約

- ES Modules使用（package.json: "type": "module"）
- 拡張子`.js`でインポート（TypeScriptの場合も）
- インポート自動整理有効
