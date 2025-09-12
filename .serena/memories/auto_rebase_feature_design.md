# arb CLI機能設計

## 概要

GitHub ActionsのAuto Rebase PR機能をCLIツールとして実装。PRのリベースを自動化し、GitHub APIを通じてPRを更新する。

## コマンド仕様

```bash
arb <pr-number> [options]
```

### オプション

- `--target <branch>`: リベース先ブランチ（デフォルトは現在のベースブランチ）
- `--token <token>`: GitHub API token（環境変数GITHUB_TOKENも可）
- `--repo <owner/repo>`: リポジトリ指定（デフォルトは現在のリポジトリ）
- `--force`: 強制実行（競合時の確認スキップ）
- `--dry-run`: 実際の変更なしで処理内容を表示

## 処理フロー

1. **引数解析**: PR番号、ターゲットブランチ、認証トークン
2. **GitHub API**: PR情報取得（head_ref, base_ref, commits）
3. **Git設定**: user.name, user.email設定
4. **リベース実行**:
   - 全ブランチをfetch
   - ターゲットブランチ存在確認
   - PRブランチをcheckout
   - commitを順次cherry-pick
   - 強制push
5. **PR更新**: ベースブランチ変更（必要時）
6. **結果通知**: コンソール出力 + GitHub APIコメント

## エラーハンドリング

- ターゲットブランチが存在しない
- Cherry-pick時の競合
- GitHub API認証エラー
- Git操作エラー

## 必要な依存関係

- GitHub API: `@octokit/rest`
- Git操作: `simple-git` または `child_process`でgitコマンド実行
- UI: Inkのコンポーネント（進捗表示、エラー表示）

## セキュリティ考慮

- GitHub token の安全な取り扱い
- Git操作時の権限確認
- 強制pushの警告表示
