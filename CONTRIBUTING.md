# Contributing to arb

Thank you for your interest in contributing to arb! We welcome contributions from everyone.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check [this list](https://github.com/riya-amemiya/arb/issues) as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- Use a clear and descriptive title
- Describe the exact steps which reproduce the problem
- Provide specific examples to demonstrate the steps
- Describe the behavior you observed after following the steps
- Explain which behavior you expected to see instead and why
- Include details about your configuration and environment

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- Use a clear and descriptive title
- Provide a step-by-step description of the suggested enhancement
- Provide specific examples to demonstrate the steps
- Describe the current behavior and explain which behavior you expected to see instead
- Explain why this enhancement would be useful

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- Bun

### Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/arb.git
   cd arb
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

### Development Commands

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Development mode (watch for changes)
bun run dev

# Run linting and formatting checks
bun run test

# Fix linting and formatting issues
bun run lint

# Test the CLI locally
node dist/cli.js
```

### Testing

We use Biome for linting and code formatting. Make sure your changes pass all checks:

```bash
bun run test
```

If there are any issues, you can fix them automatically with:

```bash
bun run lint
```

### Code Style

- We use Biome for code formatting and linting
- Use TypeScript for all new code
- Follow the existing code style and patterns
- Write clear, self-documenting code
- Add comments for complex logic

### Commit Messages

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance tasks

Examples:

- `feat: add support for custom rebase strategies`
- `fix: handle merge conflicts properly in linear mode`
- `docs: update usage examples in README`

### Project Structure

```tree
src/
├── cli.tsx         # CLI entry point
├── app.tsx         # Main application component
├── github.ts       # GitHub API integration
└── git.ts          # Git operations and utilities
```

## Questions?

Feel free to open an issue if you have any questions about contributing!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
