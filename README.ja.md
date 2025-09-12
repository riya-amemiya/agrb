# arb（auto-rebase）

<a href="https://github.com/sponsors/riya-amemiya"><img alt="Sponsor" src="https://img.shields.io/badge/sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#white" /></a>

対話的にブランチを別ブランチへ安全に載せ替えるCLIです。`cherry-pick`ベースの「マージコミットを除外した巻き直し」と、純粋な`git rebase`による線形履歴の両方をサポートします。Inkで実装されたUIにより、対象ブランチをインタラクティブに選択できます。

## インストール

```bash
npm install --global arb
```

## 使い方

```bash
arb [options]
```

オプション一覧:

- `--target, -t <branch>`: 対象ブランチ。未指定の場合はインタラクティブに選択します
- `--allow-empty`: cherry-pick時に空コミットを許可します
- `--skip`: cherry-pick時に空コミットやコンフリクト発生コミットをスキップします
- `--linear`: `git rebase` による線形履歴モードを使用します（デフォルトはcherry-pickベース）
- `--continue-on-conflict`: 線形rebase時にコンフリクトが出ても継続（`-X ours`を使用し、自動解決して`--continue`を試行）
- `--remote-target`: 対象ブランチの選択にリモート追跡ブランチ（`origin/*`）を使用します

### 例

```bash
# mainへ載せ替え（cherry-pickベース）
arb --target main

# developへ線形rebaseで載せ替え
arb --target develop --linear

# コンフリクトがあっても ours 戦略で継続
arb --linear --continue-on-conflict

# 対象ブランチをリモートブランチから選ぶ
arb --remote-target

# 空コミットを許可/スキップ
arb --allow-empty
arb --skip
```

## 動作の概要

デフォルト（cherry-pick）モードでは、ターゲットブランチと現在のブランチの`merge-base`から現在ブランチまでの非マージコミットを順に適用します。空コミットやコンフリクトに対する振る舞いは`--allow-empty`/`--skip`で制御できます。完了後は一時ブランチの内容を現在ブランチへ`reset --hard`で反映します。

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
