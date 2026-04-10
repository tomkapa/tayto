<div align="center">

![Tayto - Task management for solo developers and AI agents](banner.png)

[![npm](https://img.shields.io/npm/v/@tomkapa/tayto)](https://www.npmjs.com/package/@tomkapa/tayto)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D25-brightgreen)](https://nodejs.org)

**Stop losing tasks between AI sessions. Stop drowning in Jira fields you don't need.**

Tayto is a local-first task manager built for solo developers who work with AI coding agents. Two interfaces, one SQLite database, zero configuration.

[Quick Start](#quick-start) &bull; [Why Tayto](#why-tayto) &bull; [Workflow](#workflow) &bull; [CLI Reference](#cli-reference) &bull; [TUI Reference](#tui-reference)

</div>

---

## Why Tayto

Every project management tool out there assumes you're on a team. They want you to configure sprints, assign story points, set due dates, and fill out fifteen fields before you can track a single task.

If you're a solo dev shipping with AI agents like Claude Code, you need something different:

- **You forget things.** A quick idea during a coding session, a tech debt note from an AI-generated feature, a bug you noticed but can't fix right now. Without a fast capture tool, these vanish.
- **AI generates work faster than you can track it.** Your agent builds five features in an afternoon. Each one leaves behind edge cases, missing tests, and shortcuts. That debt is invisible until it bites you.
- **Priority fields are a lie.** When you're the only one executing, all that matters is order: what's first, what's next. Row 1 in the task list is what you do now. That's it.
- **Your AI agent can't use Jira.** It needs a CLI that speaks JSON. Your existing tools weren't built for this.

Tayto solves exactly this: a **CLI for agents** and a **TUI for humans**, sharing the same local SQLite database. No server. No login. No internet required.

---

## Workflow

Tayto follows a lean, agile-inspired loop designed for how solo devs actually work:

![Workflow](workflow.png)

**1. Capture** &mdash; Use AI to generate tasks from feature plans, record tech debt, or break down epics. Never lose an idea again.

**2. Prioritize** &mdash; You review the backlog and drag tasks into execution order. No story points. No priority matrices. Just: what's first?

**3. Enrich** &mdash; AI analyzes the codebase and writes implementation-ready technical notes for the top backlog items.

**4. Review** &mdash; You read the plan. Approve it, adjust it, or send it back.

**5. Execute** &mdash; AI implements the first `todo` task. You review the code. Cycle repeats.

> Don't plan too far ahead. Keep tasks in the backlog. If something becomes urgent, re-rank it. Enrich only what's next. Ship what's ready. Simple.

---

## Quick Start

```bash
# Install globally from npm
npm install -g @tomkapa/tayto

# Create a project (auto-links to current git repo)
tayto project create -n "my-app" --default

# Capture some tasks
tayto task create -n "Fix auth token refresh" -t bug
tayto task create -n "Add user dashboard" -t story
tayto task create -n "Refactor DB connection pooling" -t tech-debt

# Re-rank: put the bug at the top
tayto task rank <bug-id> --top

# Launch the TUI to review your backlog
tayto
```

---

## Installation

```bash
npm install -g @tomkapa/tayto
```

Or build from source:

```bash
git clone https://github.com/tomkapa/tayto && cd tayto
npm install && npm run build
npm link
```

**Requires:** Node.js >= 25

---

## Two Interfaces, One Database

### CLI &mdash; Built for AI Agents and Scripts

Every command returns structured JSON to stdout. Errors go to stderr with exit code 1.

```jsonc
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

This makes Tayto a natural fit for AI coding agents. Claude Code can create tasks, search the backlog, read technical notes, and update status &mdash; all through simple CLI calls.

### TUI &mdash; Built for Humans

Run `tayto` with no arguments to launch an interactive terminal UI with:

- Rich markdown rendering for task descriptions and technical notes
- Vim-style navigation (`j`/`k`)
- Inline filtering by status, type, and priority
- Full-text search across all task fields
- Task creation, editing, and status management without leaving the terminal

---

## CLI Reference

### Project Management

```bash
tayto project create -n "my-app" -d "Description" --default
tayto project list
tayto project update <id> -n "new-name" --default
tayto project delete <id>
tayto project link <id> --remote <git-remote-url>
tayto project unlink <id>
```

Projects auto-detect the current git remote, so `tayto` in a repo directory uses the right project automatically.

### Task Management

```bash
# Create
tayto task create \
  -n "Fix login bug" \
  -t bug \
  -s todo \
  -p "my-app" \
  -d "Login fails on mobile" \
  --technical-notes "Check JWT expiry logic" \
  --additional-requirements "Must work on iOS Safari"

# List and search
tayto task list
tayto task list --status in-progress --type bug
tayto task search "login"

# Update
tayto task update <id> -s in-progress
tayto task update <id> --append-notes "Root cause: token not refreshed"
tayto task update <id> --append-requirements "Also fix on Android"

# Re-rank (execution order)
tayto task rank <id> --top
tayto task rank <id> --bottom
tayto task rank <id> --before <other-id>
tayto task rank <id> --after <other-id>
tayto task rank <id> --position 3

# Break down into subtasks
tayto task breakdown <parent-id> -f subtasks.json

# Delete
tayto task delete <id>

# Export / Import
tayto task export -o backup.json
tayto task import -f backup.json
```

### Dependency Management

```bash
tayto dep add <task-id> <depends-on-id>
tayto dep add <task-id> <depends-on-id> -t blocked-by
tayto dep remove <task-id> <depends-on-id>
tayto dep list <task-id>
tayto dep graph <task-id>
```

Dependency types: `blocks`, `blocked-by`, `relates-to`, `duplicates`

---

## TUI Reference

Launch with `tayto` or `tayto tui`.

| Key | Action |
|---|---|
| `j` / `k` / arrows | Navigate |
| `Enter` | Open task detail |
| `c` | Create task |
| `e` | Edit task |
| `d` | Delete task |
| `s` | Cycle status |
| `/` | Search |
| `f` | Filter by status |
| `t` | Filter by type |
| `0` | Clear filters |
| `p` | Switch project |
| `?` | Help |
| `q` | Quit |

---

## Data Model

### Task Types

| Type | Use for |
|---|---|
| `story` | Features and user stories |
| `tech-debt` | Refactoring, cleanup, missing tests |
| `bug` | Defects and issues |

### Statuses

`backlog` &rarr; `todo` &rarr; `in-progress` &rarr; `review` &rarr; `done` (or `cancelled`)

### Task Fields

Each task carries rich context for AI consumption:

- **name** &mdash; short summary
- **description** &mdash; user-facing details
- **technical_notes** &mdash; implementation guidance (appendable)
- **additional_requirements** &mdash; constraints and edge cases (appendable)
- **rank** &mdash; execution order within the project
- **parent_id** &mdash; hierarchical breakdown support

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TASK_DB_PATH` | `~/.task/data.db` | SQLite database path |
| `TASK_DATA_DIR` | `~/.task` | Data directory |
| `TASK_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | &mdash; | OpenTelemetry collector |

Database is created automatically on first run. All data stays on your machine.

---

## Claude Code Integration

Tayto ships with Claude Code skills for the full AI-assisted workflow:

| Skill | What it does |
|---|---|
| `/tayto` | Manage projects and tasks from conversation |
| `/implement-task` | Pick the top todo and implement it |
| `/enrich-task` | Research the codebase and write technical notes for the next backlog item |

The CLI's JSON output format means any AI agent with shell access can interact with Tayto &mdash; no special integration needed.

---

## Architecture

```
CLI (Commander.js) ──┐
                     ├──> Service Layer (Zod validation) ──> Repository ──> SQLite
TUI (Ink/React) ─────┘
```

- **Result\<T\>** return type across all layers &mdash; no thrown exceptions
- **OpenTelemetry** tracing on every operation
- **FTS5** full-text search across task fields
- **ULID** identifiers &mdash; sortable, collision-free
- **Fractional ranking** &mdash; O(1) reorder without renumbering

---

## Development

```bash
npm run dev          # watch mode
npm run test         # run tests
npm run check        # prettier + eslint
npm run build        # production build
```

## License

MIT
