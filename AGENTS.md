# GEMINI.md

## Project Overview

This project is a command-line interface (CLI) tool named `agrb` (auto git rebase) that provides an interactive and safe way to rebase a Git branch onto another. The tool is built with TypeScript, React (using Ink for the CLI UI), and Node.js.

The core functionality of `agrb` is to simplify the rebase process by offering two different strategies:

1. **Cherry-pick based replay**: This is the default strategy. It identifies the non-merge commits between the current branch and the target branch and applies them one by one to a temporary branch created from the target. This method avoids issues with merge commits in the history.
2. **Linear history via `git rebase`**: This strategy uses the standard `git rebase` command to create a linear history.

The tool is designed to be interactive, allowing the user to select the target branch from a list of available branches if not specified via command-line arguments.

## Building and Running

The project uses `bun` for package management and running scripts.

**Install Dependencies:**

```bash
bun install
```

**Build the project:**

```bash
bun run build
```

**Run in development mode (with file watching):**

```bash
bun run dev
```

**Lint the code:**

```bash
bun run lint
```

**Run tests:**

```bash
bun run test
```

## Development Conventions

**Code Style**: The project uses Biome for code formatting and linting. The configuration can be found in the `biome.json` file.
**Testing**: The project uses Biome for checking the code.
**Contribution**: Contribution guidelines are available in `CONTRIBUTING.md`.
