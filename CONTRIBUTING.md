# Contributing to Tayto

Thanks for taking the time to contribute! This document covers how to get the dev environment running, how to submit changes, and what the code expects.

## Prerequisites

- Node.js >= 25 (use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- npm >= 10

## Setup

```bash
git clone https://github.com/tomkapa/tayto
cd tayto
npm install
npm run build
npm link          # makes `tayto` available globally from local source
```

## Development

```bash
npm run dev       # watch mode — rebuilds on file change
npm test          # run all tests (316 tests, must all pass)
npm run check     # prettier + eslint — must pass before commit
npm run build     # production build to dist/
```

## Project Structure

```
src/
  cli/          # Commander.js commands
  tui/          # Ink/React terminal UI
  services/     # Business logic (Zod-validated inputs)
  repository/   # SQLite queries
  db/           # Database setup, migrations
  telemetry/    # OpenTelemetry setup
tests/          # Vitest test files (mirrors src/ structure)
```

## Code Conventions

- **Strict TypeScript** — no `any`, no suppressed errors, prefer types that catch bugs at compile time
- **No swallowed errors** — all errors must be handled explicitly; use the `Result<T>` type
- **Rich logs** — use OpenTelemetry spans/attributes for debug context, not bare `console.log`
- **SOLID + DRY** — keep services single-responsibility; extract shared logic
- **Tests first** — write tests before implementing; all code must be covered
- **CLI/TUI consistency** — actions and results must behave identically in both interfaces

## Before You Submit

1. All tests pass: `npm test`
2. Lint and format clean: `npm run check`
3. New behaviour has tests
4. Commit messages follow the existing style (`feat:`, `fix:`, `refactor:`, etc.)

## Pull Requests

- Open a PR against `main`
- Reference any related issue in the PR description
- Keep PRs focused — one feature or fix per PR
- CI must be green before merge

## Reporting Issues

Use [GitHub Issues](https://github.com/tomkapa/tayto/issues). For bugs, include:
- Tayto version (`tayto --version`)
- Node.js version (`node --version`)
- OS and terminal
- Steps to reproduce
- Expected vs actual behaviour

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
