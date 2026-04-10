# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[Unreleased]: https://github.com/tomkapa/tayto/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/tomkapa/tayto/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/tomkapa/tayto/compare/v0.3.0...v0.4.0
