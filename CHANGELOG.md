# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-04-13

### Added
- What's new ticker and changelog dialog for post-upgrade visibility

## [0.7.0] - 2026-04-12

### Added
- Prompt to create project when unlinked git remote is detected on TUI startup
- Project edit support in TUI and `--git-remote` flag for CLI
- Git remote field to create project form
- Arrow key navigation and inline cursor movement in form fields

### Changed
- Introduce `GitRemote` value object to enforce URL normalization

### Fixed
- Restore terminal raw mode around external editor to prevent readonly mode

## [0.6.0] - 2026-04-12

### Added
- Auto-upgrade with npm registry version check and `tayto upgrade` command
- Contextual hints in TUI for discoverability
- Shift+Tab panel navigation in TUI

### Changed
- Improve TUI intuitiveness with better keyboard shortcut guidance

### Chore
- Add open-source project scaffolding and fix CI node version
- Add demo video to README

## [0.5.0] - 2026-04-10

### Changed
- Redesign TUI color theme around #9B9BA5 (logo helmet grey) for consistent palette
- Redesign header with 3-column layout: logo, product info, and shortcut hints
- Integrate Tayto pixel logo into TUI header bar

### Improved
- Consolidate logo assets into `src/tui/assets/` and `src/tui/components/Logo.tsx`
- Theme colors now import from logo PALETTE for single source of truth
- Memoize Logo component to avoid unnecessary re-renders

### Removed
- Standalone `tayto-logo/` directory (AGENT.md, preview PNGs)

## [0.4.1] - 2026-04-10

### Fixed
- Prevent rank collisions from floating-point precision collapse
- Scope `listTasks` and `searchTasks` to default project when none specified

### Changed
- Resolve project at CLI/TUI boundary; services now accept `Project` directly

## [0.4.0] - 2026-04-09

### Added
- Link projects to git remotes for automatic project selection
- Running `tayto` inside a git repo auto-selects the linked project

## [0.3.0]

### Added
- Dependency management (`tayto dep add/remove/list/graph`)
- Dependency types: `blocks`, `blocked-by`, `relates-to`, `duplicates`
- Task breakdown command to split tasks into subtasks

## [0.2.0]

### Added
- TUI (terminal UI) built with Ink/React
- Full-text search via SQLite FTS5
- Task export and import (JSON)
- OpenTelemetry tracing on every operation

## [0.1.0]

### Added
- Initial release
- CLI with Commander.js
- SQLite database backend with ULID identifiers
- Fractional ranking for O(1) reorders
- Task types: `story`, `bug`, `tech-debt`
- Task statuses: `backlog` → `todo` → `in-progress` → `review` → `done` / `cancelled`
- Project management with default project support
- Zod validation across all service layer inputs

[Unreleased]: https://github.com/tomkapa/tayto/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/tomkapa/tayto/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/tomkapa/tayto/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/tomkapa/tayto/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/tomkapa/tayto/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/tomkapa/tayto/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/tomkapa/tayto/compare/v0.3.0...v0.4.0