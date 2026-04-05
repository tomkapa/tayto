# tayto CLI — Full Command Reference

Binary: `tayto`  
Version: 0.1.0

---

## project

```
tayto project create -n <name> [-k <key>] [-d <description>] [--default]
tayto project list
tayto project update <idOrKeyOrName> [-n <name>] [-k <key>] [-d <description>]
tayto project delete <idOrKeyOrName>
tayto project set-default <idOrKeyOrName>
```

- `--default` on create sets this project as the active default
- `<key>` is 2-10 alphanumeric chars (auto-derived from name if omitted)
- Lookup accepts id, key (e.g. `ABC`), or full name

---

## tayto task

```
tayto task create [-n <name>] [-p <project>] [-d <description>]
                 [-t epic|story|tech-debt|bug] [-s <status>]
                 [--parent <parentId>] [--technical-notes <md>]
                 [--additional-requirements <md>]
                 [--depends-on <id>...]

tayto task list [-p <project>] [-s <status>] [-t <type>]
               [-l <level>] [--parent <parentId>] [--search <text>]

tayto task show <id>

tayto task update <id> [-n <name>] [-d <description>] [-t <type>] [-s <status>]
                 [--parent <parentId>] [--technical-notes <md>]
                 [--additional-requirements <md>]
                 [--append-notes <md>] [--append-requirements <md>]

tayto task delete <id>

tayto task breakdown <parentId> -f <jsonFile>

tayto task rank <id> [--after <taskId>] [--before <taskId>]
               [--position <n>] [-p <project>]

tayto task search <query> [-p <project>]

tayto task export [-p <project>] [-o <outputFile>]
tayto task import [-p <project>] [-f <inputFile>]
```

**Status values**: `backlog`, `todo`, `in-progress`, `review`, `done`, `cancelled`  
**Type values**: `epic`, `story`, `tech-debt`, `bug`  
**Level values**: `1` (epic), `2` (story/tech-debt/bug — default)

The `list` command outputs tasks in rank order. Default status filter is `backlog`.

- `-l 1` lists only epics; `-l 2` (default) lists only work items.
- `--parent <epicId>` filters to children of a specific epic.
- Ranking is scoped by level — epics rank among epics, work items among work items.

The `breakdown` command requires an epic parent and expects a JSON file containing an array of subtask objects (must be level 2 types — not epic):
```json
[
  { "name": "Subtask A", "description": "...", "type": "story" },
  { "name": "Subtask B", "description": "..." }
]
```

The `rank` command uses Jira-style relative positioning (within the same level):
- `--after <id>` places task immediately after the given task
- `--before <id>` places task immediately before the given task
- `--position <n>` places at 1-based position in the list
- Anchor task must be at the same level as the task being ranked

**Parent-child constraints:**
- Only epics can be parents (`--parent <storyId>` is rejected).
- Epics cannot have a parent.
- Changing type from epic to a work type is rejected if the epic has children.
- Changing type to epic is rejected if the task has a parent.

**Auto-status propagation:**
- Child → `in-progress` while parent is `backlog`/`todo` → parent auto-moves to `in-progress`.
- All children terminal (`done`/`cancelled`) → parent auto-moves to `done`.

---

## tayto dep

```
tayto dep add <taskId> <dependsOnId> [-t blocks|relates-to|duplicates|blocked-by]
tayto dep remove <taskId> <dependsOnId>
tayto dep list <taskId>
tayto dep graph <taskId>
```

- Default dependency type is `blocks` (taskId is blocked by dependsOnId)
- `dep graph` outputs a Mermaid diagram of the full dependency tree centered on taskId
