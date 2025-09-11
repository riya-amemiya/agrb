# auto-rebase

Interactive CLI to safely rebase a branch onto another. Supports two strategies:

- Cherry-pick based replay that skips merge commits
- Linear history via `git rebase`

The UI is built with Ink and lets you select the target branch interactively.

Read this in Japanese: see `README.ja.md`.

## Install

```bash
npm install --global auto-rebase
```

## Usage

```bash
auto-rebase [options]
```

Options:

- `--target, -t <branch>`: Target branch. If omitted, select interactively
- `--allow-empty`: Allow empty commits during cherry-pick
- `--skip`: Skip empty/conflicting commits during cherry-pick
- `--linear`: Use `git rebase` for a linear history (default is cherry-pick)
- `--continue-on-conflict`: Continue linear rebase when conflicts occur (`-X ours` + `--continue`)
- `--remote-target`: Select target branch from remote tracking branches (`origin/*`)

### Examples

```bash
# Rebase onto main (cherry-pick based)
auto-rebase --target main

# Rebase onto develop with linear history
auto-rebase --target develop --linear

# Continue on conflicts using ours strategy
auto-rebase --linear --continue-on-conflict

# Select target from remote branches
auto-rebase --remote-target

# Allow/skip empty commits
auto-rebase --allow-empty
auto-rebase --skip
```

## How it works

In the default cherry-pick mode, non-merge commits between `merge-base(<target>, <current>)` and the current branch are applied onto a temporary branch created from `<target>`. On success, the current branch is hard-reset to the temp branch.

In linear mode (`--linear`), `git rebase origin/<target>` is executed. With `--continue-on-conflict`, the command tries `-X ours`, stages changes, and runs `git rebase --continue`.

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Dev (watch)
bun run dev

# Lint (check/fix)
bun run test
bun run lint
```

## License

MIT

## Contributing

Issues and PRs are welcome. See CONTRIBUTING for details.
