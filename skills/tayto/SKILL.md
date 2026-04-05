---
name: tayto
description: >
  Interact with the `tayto` CLI to manage projects and tasks for the current repo.
  Use this skill whenever the user asks to implement a task, plan work, search for
  related tasks, break down a feature, reorder the backlog, manage dependencies,
  or anything involving task tracking. Also trigger when the user says things like
  "what tasks are related to X", "organize my backlog", "add subtasks for Y",
  "mark Z as done", or "what should I work on next".
---

# tayto CLI Skill

This skill teaches you to operate the `tayto` CLI — a task management tool for solo developers and AI agents. The binary is `tayto` (installed globally or via `npx` in the project).

Read `references/commands.md` for the full flag reference. This document covers the higher-level patterns.

---

## Core Concepts

- **Projects** group tasks. A default project is set with `tayto project set-default`.
- **Tasks** live inside a project and have: name, description, type, status, optional parent, and rank order.
- **Task types**: `epic`, `story`, `tech-debt`, `bug`.
- **Task levels**: Types map to levels. `epic` = level 1 (grouping layer), `story`/`tech-debt`/`bug` = level 2 (work layer).
- **Parent-child rules**: Level 2 tasks can have zero or one epic parent. Epics cannot have parents. Only epics can be parents.
- **Dependencies** express relationships between tasks: `blocks`, `blocked-by`, `relates-to`, `duplicates`. The direction matters: `tayto dep add A B` means A is blocked by B (A depends on B).
- **Rank** is the priority order within the backlog. Lower rank = higher priority. Ranking is scoped by level — epics rank among epics, work items among work items.
- **Auto-status propagation**: When a child moves to `in-progress` and its epic parent is `backlog`/`todo`, the parent auto-moves to `in-progress`. When all children of an epic reach terminal status (`done`/`cancelled`), the epic auto-moves to `done`.

---

## Workflow Patterns

### 1. Implementing a task

When the user says "implement task X" or "work on feature Y":

1. **Search for existing tasks** to avoid duplicates and find related context:
   ```
   task task search "Y"
   ```
2. **Show the task** to read its full description, technical notes, and requirements:
   ```
   task task show <id>
   ```
3. **Check its dependencies** — what must be done first:
   ```
   task dep list <id>
   task dep graph <id>   # full tree as Mermaid
   ```
4. **Update status** to signal work has started:
   ```
   task task update <id> -s in-progress
   ```
5. Implement the work, then **mark done**:
   ```
   task task update <id> -s done
   ```

When returning after implementation, append notes about what was done:
```
tayto task update <id> --append-notes "Implemented via X approach. Key decisions: ..."
```

---

### 2. Breaking down a feature into subtasks

When the user asks to break down a large task:

1. Create the parent **epic** if it doesn't exist:
   ```
   tayto task create -n "Feature: auth system" -t epic -d "..."
   ```
2. Write a breakdown JSON file (e.g. `/tmp/subtasks.json`). Subtasks must be level 2 types (story, tech-debt, bug — not epic):
   ```json
   [
     { "name": "Design DB schema", "type": "tech-debt", "description": "..." },
     { "name": "Implement login endpoint", "type": "story", "description": "..." },
     { "name": "Add JWT middleware", "type": "story", "description": "..." }
   ]
   ```
3. Run breakdown (parent must be an epic):
   ```
   tayto task breakdown <epicId> -f /tmp/subtasks.json
   ```
4. Add dependencies between subtasks in logical order:
   ```
   task dep add <loginId> <schemaId>     # login endpoint depends on schema
   task dep add <jwtId> <loginId>        # JWT middleware depends on login
   ```
5. Rank the subtasks so they reflect execution order:
   ```
   task task rank <schemaId> --position 1
   task task rank <loginId> --after <schemaId>
   task task rank <jwtId> --after <loginId>
   ```

---

### 3. Dependency-aware backlog ordering

When the user asks to "reorder tasks based on dependencies" or "what should I work on next":

1. List all backlog tasks:
   ```
   task task list -s backlog
   ```
2. For each task with dependencies, inspect its graph:
   ```
   task dep graph <id>
   ```
3. Perform a mental topological sort: tasks with no blockers come first.
4. Re-rank to reflect the order:
   ```
   task task rank <unblocked-id> --position 1
   task task rank <next-id> --after <unblocked-id>
   # ...
   ```
5. Tell the user: "Here's the optimal work order and why."

---

### 4. Finding tasks related to current work

When the user asks "what tasks are related to X" or before starting new work:

```
tayto task search "X"
tayto task list --search "X"    # also filters live
```

Then `tayto task show <id>` for any promising results to read full context.

If you find a task that covers what the user wants to build, say so — avoid creating duplicates.

---

### 5. Importing tasks from an external system

When the user wants to migrate tasks from Jira, Linear, or any other tracker:

1. **Prepare or locate the JSON file.** The format is:
   ```json
   {
     "version": 1,
     "tasks": [
       {
         "id": "JIRA-101",
         "name": "Design auth flow",
         "description": "...",
         "type": "story",
         "status": "done",
         "parentId": "JIRA-100",
         "technicalNotes": "...",
         "additionalRequirements": "..."
       }
     ],
     "dependencies": [
       { "taskId": "JIRA-102", "dependsOnId": "JIRA-101", "type": "blocks" }
     ]
   }
   ```
   - `tasks[].id` is the **source system ID** (e.g. Jira key). It is used to link old IDs to newly created tayto IDs.
   - `dependencies` reference tasks by their source IDs — tayto remaps them automatically.
   - `parentId` also references source IDs and is remapped during import.

2. **Run the import** (basic — field names already match):
   ```
   tayto task import -f /path/to/tasks.json
   tayto task import -f /path/to/tasks.json -p MyProject
   ```

3. **Use `--map` when source field names differ** from tayto's schema. Provide comma-separated `source:target` pairs:
   ```
   tayto task import -f /path/to/tasks.json \
     --map "key:id,title:name,summary:description,category:type"
   ```
   This maps the source's `key` field to tayto's `id`, `title` to `name`, etc. Mappable target fields: `id`, `name`, `description`, `type`, `status`, `parentId`, `technicalNotes`, `additionalRequirements`, `taskId`, `dependsOnId`.

4. **Read the output.** The command returns an `ImportResult` with:
   - `imported` — count of tasks created
   - `dependencies` — count of dependencies added
   - `idMap` — a mapping of every source ID to its new tayto ID (e.g. `"JIRA-101" → "abc123"`)

   Use the `idMap` to cross-reference old tickets.

**Key behaviors:**
- Tasks are topologically sorted by parent-child relationships so parents are created before children.
- Status values must match tayto's values exactly: `backlog`, `todo`, `in-progress`, `review`, `done`, `cancelled`. There is no automatic normalisation (e.g. `"TODO"` will fail — use `"todo"`).
- Task types must be one of: `epic`, `story`, `tech-debt`, `bug`.
- Parent-child constraints apply during import: only epics can be parents, and subtasks cannot be epics.
- Dependency types: `blocks` (default), `relates-to`, `duplicates`.
- See `samples/import-example.json` for a complete example with tasks, parent-child hierarchies, and dependencies.

---

### 6. Working with epics

Epics are level 1 tasks that group related work items.

1. **Create an epic**:
   ```
   tayto task create -n "Auth System" -t epic -d "..."
   ```

2. **List epics only**:
   ```
   tayto task list -l 1
   ```

3. **List work items only** (default):
   ```
   tayto task list              # defaults to level 2
   tayto task list -l 2         # explicit
   ```

4. **Assign a work task to an epic**:
   ```
   tayto task update <taskId> --parent <epicId>
   ```

5. **Unassign from epic**:
   ```
   tayto task update <taskId> --parent ""
   ```

6. **List children of an epic**:
   ```
   tayto task list --parent <epicId>
   ```

**Level constraints enforced by the CLI:**
- Epics cannot have a parent (`--parent` is rejected for epic-type tasks).
- Only epics can be parents; `--parent <storyId>` is rejected.
- Changing type from epic to story is rejected if the epic has children.
- Changing type to epic is rejected if the task has a parent.
- Ranking operates within the same level — epics rank among epics, work items among work items.

**Auto-status propagation:**
- When a child transitions to `in-progress` and its parent epic is `backlog` or `todo`, the epic automatically moves to `in-progress`.
- When all children of an epic are terminal (`done`/`cancelled`), the epic automatically moves to `done`.

---

### 7. Creating a new task with full context (including epic parent)

When you need to log a new task with all relevant information:

```
tayto task create \
  -n "Name of task" \
  -t story \
  -d "One-sentence summary" \
  --technical-notes "## Approach\n\nContext and design decisions..." \
  --additional-requirements "- Must handle edge case X\n- Should integrate with Y" \
  --depends-on <blockerId>
```

Fill `--technical-notes` with what you know about the implementation approach. Fill `--additional-requirements` with constraints or acceptance criteria. This makes the task useful to future agents.

---

### 8. Updating task status and notes during implementation

Keep tasks accurate as you work. Don't wait until you're done:

```
# Starting work
tayto task update <id> -s in-progress

# Discovered a constraint mid-implementation
tayto task update <id> --append-notes "Found that X requires Y because ..."

# Done
tayto task update <id> -s done --append-notes "Completed. Implementation lives in src/..."
```

---

## Tips

- Always `tayto task show <id>` before modifying a task — read what's there first.
- Use `tayto dep graph <id>` to visualize the full dependency tree when the user asks about sequencing or blockers.
- When a task is too broad, break it down with `breakdown` rather than trying to tackle it whole.
- Export the backlog to JSON when the user needs a snapshot or wants to import/migrate:
  ```
  task task export -o /tmp/backlog.json
  ```
- The `search` command uses FTS5 full-text search, so it handles partial words and multi-term queries well.
