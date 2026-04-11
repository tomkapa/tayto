<div align="center">

![Tayto - Task management for solo developers and AI agents](banner.png)

[![npm](https://img.shields.io/npm/v/@tomkapa/tayto)](https://www.npmjs.com/package/@tomkapa/tayto)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D25-brightgreen)](https://nodejs.org)

**Stop losing tasks between AI sessions. Stop drowning in Jira fields you don't need.**

A local-first task manager built for solo developers who work with AI coding agents.
CLI for agents. TUI for humans. One SQLite database. Zero configuration.

[Install](#install) &bull; [Workflow](#workflow) &bull; [Agent Integration](#works-with-every-coding-agent) &bull; [Claude Code Skills](#claude-code-skills)

</div>

---

## Install

```bash
npm install -g @tomkapa/tayto
```

**Requires:** Node.js >= 25

---

## Demo

![Demo](https://raw.githubusercontent.com/tomkapa/taskcli/main/demo.gif)

---

## Workflow

![Workflow](workflow.png)

**1. Capture** &mdash; AI generates tasks from feature plans, records tech debt, logs bugs.

**2. Prioritize** &mdash; You drag tasks into execution order. No story points. Just: what's first?

**3. Enrich** &mdash; AI researches the codebase and writes implementation-ready technical notes.

**4. Review** &mdash; You read the plan. Approve, adjust, or send it back.

**5. Execute** &mdash; AI implements the top `todo` task. You review the code. Cycle repeats.

---

## Works With Every Coding Agent

Tayto's CLI outputs structured JSON to stdout &mdash; any agent with shell access can manage your tasks.

```jsonc
// Every command returns a consistent envelope
{ "ok": true, "data": { ... } }
```

<table>
<tr>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/anthropic/D97757" width="40" height="40" alt="Claude Code"><br>
<b>Claude Code</b><br>
<sub>First-class skills</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/cursor/000000" width="40" height="40" alt="Cursor"><br>
<b>Cursor</b><br>
<sub>Agent mode / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/windsurf/0066FF" width="40" height="40" alt="Windsurf"><br>
<b>Windsurf</b><br>
<sub>Cascade / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/github/181717" width="40" height="40" alt="GitHub Copilot"><br>
<b>GitHub Copilot</b><br>
<sub>Agent mode / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/cline/5A9" width="40" height="40" alt="Cline"><br>
<b>Cline</b><br>
<sub>VS Code agent</sub>
</td>
</tr>
</table>

No plugins. No API keys. Just install Tayto and your agent can `tayto task list`, `tayto task create`, and `tayto task update` out of the box.

---

## Claude Code Skills

Tayto ships with [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) for the full AI-assisted workflow &mdash; no prompt engineering required.

### `/tayto`

Manage projects and tasks directly from conversation. Create tasks, search the backlog, re-rank priorities, manage dependencies &mdash; all without leaving Claude Code.

### `/enrich-task`

Picks the next backlog task, researches the codebase for relevant patterns and architecture, then writes self-contained technical notes with implementation steps, acceptance criteria, and package recommendations. Splits out future enhancements as tech-debt tasks automatically.

### `/implement-task`

Picks the highest-priority `todo` task, reads its technical notes, checks dependencies, then implements the feature step by step. Verifies the implementation against acceptance criteria before marking done.

### Adding skills to your project

Install from the community registry:

```bash
npx skills add tomkapa/tayto
```

Or from the Claude Code marketplace:

```bash
/plugin marketplace add tomkapa/tayto
/plugin install tayto
```

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

## License

MIT
