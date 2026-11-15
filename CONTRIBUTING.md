# Contributing to RedisDeck

First and foremost: Thank you for your interest in contributing to RedisDeck!
This document provides guidelines and instructions for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/redis-deck.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `yarn install` (use yarn, not npm)
5. Make your changes, then run `yarn lint`, `yarn type-check` and `yarn test`
6. Push to your fork and open a Pull Request

## Development Setup

Requires Node.js 22+ and `redis-cli` on your `PATH`.

```bash
yarn dev
```

This starts the Vite dev server at http://localhost:5173 (open this one) and the Express API at http://localhost:3000. Vite proxies `/api` to the backend. Add a Connection on the Connections page.

Other commands:

- `yarn build` then `yarn start`: production build, served on `:3000`
- `yarn electron:dev`: run the Desktop app against the dev setup
- `yarn electron:build`: build the installer into `dist-electron/`

### Tests

Tests open real Redis connections (no mocks), so Redis must be reachable. The default target is `127.0.0.1:6379`. Override it with `REDIS_TEST_HOST`, `REDIS_TEST_PORT`, `REDIS_TEST_USER`, `REDIS_TEST_PASSWORD`, `REDIS_TEST_TLS` and `REDIS_TEST_CLUSTER`. Test keys use the `test:*` prefix and are cleaned up after each test.

```bash
yarn test                     # all suites
yarn test redis.test.js       # one suite
yarn test -t "<name>"         # one case
```

### Workflows

See [client/plugins/README.md](client/plugins/README.md). Any new write route or Workflow must go through `guards/writeGuard.js`.

## Code Style

- Use consistent indentation (spaces, not tabs)
- Follow existing code patterns
- Keep functions focused and small
- Use meaningful variable and function names
- Avoid unnecessary comments - code should be self-documenting

## Commit Messages

Use clear, descriptive commit messages:

- `Add: feature description` - for new features
- `Fix: bug description` - for bug fixes
- `Update: what was updated` - for updates to existing features
- `Refactor: what was refactored` - for code refactoring
- `Docs: what documentation was updated` - for documentation changes

## Pull Request Process

1. Ensure your code follows the project's style guidelines
2. Test your changes thoroughly
3. Update documentation if needed
4. Write a clear PR description explaining:
    - What changes were made
    - Why the changes were made
    - How to test the changes
5. Reference any related issues

## Reporting Bugs

When reporting bugs, please include:

- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Node.js version, Redis version)
- Screenshots if applicable

## Feature Requests

For feature requests, please describe:

- The feature you'd like to see
- Use case or problem it would solve
- Any implementation ideas (optional)

## Questions?

Feel free to open an issue for any questions or discussions.

Thank you for contributing!
