# agrb （auto git rebase）

<a href="https://github.com/sponsors/riya-amemiya"><img alt="Sponsor" src="https://img.shields.io/badge/sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#white" /></a>

対話的にブランチを別ブランチへ安全に載せ替えるCLIです。`cherry-pick`ベースの「マージコミットを除外した巻き直し」と、純粋な`git rebase`による線形履歴の両方をサポートします。Inkで実装されたUIにより、対象ブランチをインタラクティブに選択できます。

## インストール

```bash
npm install --global agrb
```

## 使い方

```bash
agrb [options]
```

オプション一覧:

- `--target, -t <branch>`: 対象ブランチ。未指定の場合はインタラクティブに選択します
- `--allow-empty`: cherry-pick時に空コミットを許可します
- `--linear`: `git rebase` による線形履歴モードを使用します（デフォルトはcherry-pickベース）
- `--continue-on-conflict`: `linear`モードにおいて、コンフリクト発生時に`ours`戦略を用いて自動解決し、リベースを継続します
- `--remote-target`: 対象ブランチの選択にリモート追跡ブランチ（`origin/*`）を使用します
- `--on-conflict <strategy>`: `cherry-pick`モードにおけるコンフリクト解決戦略を指定します。
                             戦略:
                               - `skip` (デフォルト): コンフリクトしたコミットを自動的にスキップします。
                               - `ours`: `ours`戦略を用いてコンフリクトを自動解決します。
                               - `theirs`: `theirs`戦略を用いてコンフリクトを自動解決します。
                               - `pause`: コンフリクト発生時に一時停止し、手動での解決を促します。
                                          解決後にEnterキーを押すとリベースを再開します。

### 例

```bash
# mainへ載せ替え（cherry-pickベース）
agrb --target main

# developへ線形rebaseで載せ替え
agrb --target develop --linear

# コンフリクトがあっても ours 戦略で継続
agrb --linear --continue-on-conflict

# 対象ブランチをリモートブランチから選ぶ
agrb --remote-target

# 空コミットを許可
agrb --allow-empty
```

## 動作の概要

デフォルト（cherry-pick）モードでは、ターゲットブランチと現在のブランチの`merge-base`から現在ブランチまでの非マージコミットを順に適用します。空コミットやコンフリクトは自動でスキップされます。`--allow-empty`で空コミットを意図的に含めることも可能です。完了後は一時ブランチの内容を現在ブランチへ`reset --hard`で反映します。

線形（`--linear`）モードでは、`git rebase origin/<target>`を実行します。`--continue-on-conflict`指定時はコンフリクト検出後に自動解決（`-X ours`）を試み、`git add . && git rebase --continue`を行います。

## 開発

```bash
# 依存関係のインストール
bun install

# ビルド
bun run build

# 開発（watch）
bun run dev

# Lint（チェック/自動修正）
bun run test
bun run lint
```

## ライセンス

MIT

## 貢献

Issue/PRは歓迎です。詳細は後述のCONTRIBUTINGをご覧ください。
