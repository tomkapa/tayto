# task

Task management for solo developers and AI agents. Two interfaces, one database.

- **CLI** returns structured JSON &mdash; built for AI agents and scripting
- **TUI** renders rich markdown in the terminal &mdash; built for humans

SQLite-backed. No server. No login. Just projects and tasks.

---

## Quick Start

```bash
# Install
npm install && npm run build

# Create a project
task project create -n "my-app" --default

# Create tasks
task task create -n "Fix auth bug" -t bug --priority 1
task task create -n "Add dashboard" -t story --priority 2

# Launch the terminal UI
task
```

## Installation

**Requirements:** Node.js >= 18

```bash
git clone <repo-url> && cd task
npm install
npm run build
npm link        # makes `task` available globally
```

## Usage

### Terminal UI

Run `task` with no arguments to launch the interactive TUI.

```bash
task                          # launch TUI (default)
task tui                      # explicit launch
task tui -p "my-app"          # start with a specific project
```

#### Keyboard Shortcuts

| Key | Action |
|---|---|
| `j` / `k` / `arrows` | Navigate up/down |
| `Enter` | Open task detail |
| `c` | Create task |
| `e` | Edit task |
| `d` | Delete task (with confirmation) |
| `s` | Cycle status forward |
| `/` | Search tasks |
| `f` | Cycle status filter |
| `t` | Cycle type filter |
| `1`-`5` | Toggle priority filter |
| `0` | Clear all filters |
| `p` | Switch project |
| `Esc` / `b` | Go back |
| `?` | Show help |
| `q` | Quit |

The task detail view renders **markdown**, **code blocks**, and **technical notes** directly in the terminal.

### CLI Commands

All commands output JSON to stdout. Errors go to stderr with exit code 1.

```jsonc
// success
{ "ok": true, "data": { ... } }

// error
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

#### Project

```bash
task project create -n "my-app" -d "Description" --default
task project list
task project update <id> -n "new-name" --default
task project delete <id>
```

#### Task

```bash
# Create
task task create \
  -n "Fix login bug" \
  -t bug \
  -s todo \
  --priority 1 \
  -p "my-app" \
  -d "Login fails on mobile" \
  --technical-notes "Check JWT expiry" \
  --additional-requirements "Must work on iOS Safari"

# Read
task task list
task task list --status in-progress --type bug --search "login"
task task list --priority 1 --parent <parent-id>
task task show <id>

# Update
task task update <id> -s in-progress
task task update <id> --append-notes "Root cause: token not refreshed"
task task update <id> --append-requirements "Also fix on Android"

# Delete
task task delete <id>

# Breakdown (create subtasks from JSON)
task task breakdown <parent-id> -f subtasks.json
```

**subtasks.json** example:

```json
[
  { "name": "Implement API endpoint", "type": "story", "priority": 2 },
  { "name": "Write integration tests", "type": "story", "priority": 3 }
]
```

## Data Model

### Task Types

| Type | Description |
|---|---|
| `story` | Feature or user story |
| `tech-debt` | Refactoring or cleanup |
| `bug` | Defect or issue |

### Task Statuses

`backlog` &rarr; `todo` &rarr; `in-progress` &rarr; `review` &rarr; `done`

`cancelled` is also available for abandoned tasks.

### Priority

| Level | Label |
|---|---|
| 1 | Critical |
| 2 | High |
| 3 | Medium (default) |
| 4 | Low |
| 5 | Lowest |

### Task Breakdown

Tasks support a `parent_id` field for hierarchical decomposition. Use `task breakdown` to batch-create subtasks under a parent, or pass `--parent <id>` on `task create`.

## Configuration

Configure via environment variables.

| Variable | Default | Description |
|---|---|---|
| `TASK_DB_PATH` | `~/.task/data.db` | Path to SQLite database |
| `TASK_DATA_DIR` | `~/.task` | Data directory |
| `TASK_LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | &mdash; | OpenTelemetry collector endpoint |

The database and data directory are created automatically on first run.

## Architecture

```
CLI Commands ──┐
               ├──> Service Layer ──> Repository Layer ──> SQLite
Terminal UI ───┘
```

- **Service layer** handles validation (Zod), business logic, and project resolution
- **Repository layer** handles SQL queries with parameterized statements
- **Result\<T\>** return type across all layers &mdash; no thrown exceptions for business logic
- **OpenTelemetry** spans on every service and repository operation
- **ULID** identifiers &mdash; sortable, no database round-trip

```
src/
  cli/              # Commander.js commands, JSON output
  tui/              # Ink (React) terminal UI components
  service/          # Business logic
  repository/       # Data access
  db/               # SQLite connection, migrations
  types/            # Zod schemas, enums, Result type
  errors/           # Typed error hierarchy
  logging/          # OpenTelemetry tracer
  config/           # Environment-based configuration
```

## Development

```bash
npm run dev          # build in watch mode
npm run check        # prettier + eslint
npm run test         # run tests
npm run build        # production build
```

## License

MIT
