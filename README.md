# agrb (auto git rebase)

- [日本語](./README.ja.md)

<a href="https://github.com/sponsors/riya-amemiya"><img alt="Sponsor" src="https://img.shields.io/badge/sponsor-30363D?style=for-the-badge&logo=GitHub-Sponsors&logoColor=#white" /></a>

Interactive CLI to safely rebase a branch onto another. Supports two strategies:

- Cherry-pick based replay that skips merge commits
- Linear history via `git rebase`

The UI is built with Ink and lets you select the target branch interactively.

Read this in Japanese: see `README.ja.md`.

## Install

```bash
npm install --global agrb
```

## Usage

```bash
agrb [options]
```

Options:

- `--target, -t <branch>`: Target branch. If omitted, select interactively
- `--allow-empty`: Allow empty commits during cherry-pick
- `--linear`: Use `git rebase` for a linear history (default is cherry-pick)
- `--continue-on-conflict`: In linear mode, continue rebase on conflicts using `ours` strategy
- `--remote-target`: Select target branch from remote tracking branches (`origin/*`)
- `--on-conflict <strategy>`: In cherry-pick mode, specify conflict resolution strategy.
  - Strategies:
    - `pause` (default): pause on conflict, allowing manual resolution.
      After resolving, press Enter to continue.
    - `skip`: automatically skip the conflicting commit.
    - `ours`: automatically resolve conflict using 'ours' strategy.
    - `theirs`: automatically resolve conflict using 'theirs' strategy.
- `--config <command>`: Manage configuration (show, set, edit, reset)
- `--no-config`: Disable loading of configuration files
- `-v, --version`: Show version
- `-h, --help`: Show help

### Configuration

You can configure `agrb` via a configuration file. The configuration is resolved in the following order of precedence:

1. Command-line flags
2. Local configuration (`.agrbrc` in the project root)
3. Global configuration (`~/.config/agrb/config.json`)
4. Default values

Use the `--no-config` flag to disable loading of configuration files.

#### Managing Configuration

- `agrb --config show`: Display the current effective configuration.
- `agrb --config set`: Start an interactive editor to modify the global configuration.
- `agrb --config edit`: Open the global configuration file in your default editor (`$EDITOR`).
- `agrb --config reset`: Reset the global configuration to its default values.

### Examples

```bash
# Rebase onto main (cherry-pick based)
agrb --target main

# Rebase onto develop with linear history
agrb --target develop --linear

# Continue on conflicts using ours strategy
agrb --linear --continue-on-conflict

# Select target from remote branches
agrb --remote-target

# Allow empty commits
agrb --allow-empty
```

## How it works

In the default cherry-pick mode, non-merge commits between `merge-base(<target>, <current>)` and the current branch are applied onto a temporary branch created from `<target>`. Empty commits or conflicts are automatically skipped. You can intentionally include empty commits with `--allow-empty`. On success, the current branch is hard-reset to the temp branch.

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
