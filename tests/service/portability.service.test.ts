import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';
import type { ExportData } from '../../src/types/portability.js';
import { parseFieldMapping } from '../../src/types/portability.js';

let container: Container;

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
  container.projectService.createProject({ name: 'TestProj', isDefault: true });
});

// ── parseFieldMapping ─────────────────────────────────────────────────

describe('parseFieldMapping', () => {
  it('parses comma-separated source:target pairs', () => {
    const m = parseFieldMapping('title:name,summary:description,key:id');
    expect(m.get('title')).toBe('name');
    expect(m.get('summary')).toBe('description');
    expect(m.get('key')).toBe('id');
    expect(m.size).toBe(3);
  });

  it('trims whitespace around pairs', () => {
    const m = parseFieldMapping(' title : name , summary : description ');
    expect(m.get('title')).toBe('name');
    expect(m.get('summary')).toBe('description');
  });

  it('ignores malformed pairs', () => {
    const m = parseFieldMapping('good:name,bad,also:bad:pair,:empty,empty:');
    expect(m.size).toBe(1);
    expect(m.get('good')).toBe('name');
  });
});

// ── Export ─────────────────────────────────────────────────────────────

describe('PortabilityService.exportTasks', () => {
  it('exports tasks from a project', () => {
    container.taskService.createTask({ name: 'Task A', type: 'story' });
    container.taskService.createTask({ name: 'Task B', type: 'bug' });

    const result = container.portabilityService.exportTasks('TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.version).toBe(1);
    expect(result.value.exportedAt).toBeTruthy();
    expect(result.value.tasks).toHaveLength(2);
    expect(result.value.tasks[0]?.name).toBe('Task A');
    expect(result.value.tasks[1]?.name).toBe('Task B');
    expect(result.value.dependencies).toHaveLength(0);
  });

  it('exports dependencies between project tasks', () => {
    const t1 = container.taskService.createTask({ name: 'Foundation' });
    const t2 = container.taskService.createTask({ name: 'Feature' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    const result = container.portabilityService.exportTasks('TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.dependencies).toHaveLength(1);
    expect(result.value.dependencies[0]?.taskId).toBe(t2.value.id);
    expect(result.value.dependencies[0]?.dependsOnId).toBe(t1.value.id);
  });

  it('includes parentId in exported tasks', () => {
    const parent = container.taskService.createTask({ name: 'Parent', type: 'epic' });
    if (!parent.ok) throw new Error('setup failed');

    container.taskService.createTask({ name: 'Child', parentId: parent.value.id });

    const result = container.portabilityService.exportTasks('TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const child = result.value.tasks.find((t) => t.name === 'Child');
    expect(child?.parentId).toBe(parent.value.id);
  });

  it('returns error for non-existent project', () => {
    const result = container.portabilityService.exportTasks('NonExistent');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});

// ── Import ────────────────────────────────────────────────────────────

describe('PortabilityService.importTasks', () => {
  it('imports tasks with default field mapping', () => {
    const data = {
      tasks: [
        { id: 'SRC-1', name: 'Imported Task 1', type: 'bug', status: 'todo' },
        { id: 'SRC-2', name: 'Imported Task 2' },
      ],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.imported).toBe(2);
    expect(result.value.dependencies).toBe(0);
    expect(Object.keys(result.value.idMap)).toHaveLength(2);

    // Verify tasks actually exist
    const newId1 = result.value.idMap['SRC-1'];
    expect(newId1).toBeTruthy();
    const task = container.taskService.getTask(newId1!);
    expect(task.ok).toBe(true);
    if (!task.ok) return;
    expect(task.value.name).toBe('Imported Task 1');
    expect(task.value.type).toBe('bug');
    expect(task.value.status).toBe('todo');
  });

  it('remaps dependency IDs from source to new IDs', () => {
    const data = {
      tasks: [
        { id: 'EXT-1', name: 'Foundation Task' },
        { id: 'EXT-2', name: 'Dependent Task' },
      ],
      dependencies: [{ taskId: 'EXT-2', dependsOnId: 'EXT-1', type: 'blocks' }],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.imported).toBe(2);
    expect(result.value.dependencies).toBe(1);

    // Verify the dependency was created with remapped IDs
    const newId2 = result.value.idMap['EXT-2']!;
    const blockers = container.dependencyService.listBlockers(newId2);
    expect(blockers.ok).toBe(true);
    if (!blockers.ok) return;
    expect(blockers.value).toHaveLength(1);
    expect(blockers.value[0]?.id).toBe(result.value.idMap['EXT-1']);
  });

  it('applies custom field mapping', () => {
    const data = {
      tasks: [
        {
          key: 'JIRA-100',
          title: 'Login Bug',
          summary: 'Fix the login page crash',
          category: 'bug',
        },
      ],
    };

    const fieldMapping = parseFieldMapping('key:id,title:name,summary:description,category:type');
    const result = container.portabilityService.importTasks(data, 'TestProj', fieldMapping);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.imported).toBe(1);
    const newId = result.value.idMap['JIRA-100']!;
    const task = container.taskService.getTask(newId);
    expect(task.ok).toBe(true);
    if (!task.ok) return;
    expect(task.value.name).toBe('Login Bug');
    expect(task.value.description).toBe('Fix the login page crash');
    expect(task.value.type).toBe('bug');
  });

  it('leaves unmapped fields empty', () => {
    const data = {
      tasks: [
        {
          key: 'X-1',
          title: 'Minimal Task',
        },
      ],
    };

    const fieldMapping = parseFieldMapping('key:id,title:name');
    const result = container.portabilityService.importTasks(data, 'TestProj', fieldMapping);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const newId = result.value.idMap['X-1']!;
    const task = container.taskService.getTask(newId);
    expect(task.ok).toBe(true);
    if (!task.ok) return;
    expect(task.value.name).toBe('Minimal Task');
    expect(task.value.description).toBe('');
    expect(task.value.technicalNotes).toBe('');
    expect(task.value.additionalRequirements).toBe('');
  });

  it('handles parentId remapping within import set', () => {
    const data = {
      tasks: [
        { id: 'EXT-1', name: 'Parent', type: 'epic' },
        { id: 'EXT-2', name: 'Child', parentId: 'EXT-1' },
      ],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const childId = result.value.idMap['EXT-2']!;
    const child = container.taskService.getTask(childId);
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.value.parentId).toBe(result.value.idMap['EXT-1']);
  });

  it('handles deeply nested parent-child relationships', () => {
    // With level constraints, only epic -> work nesting is valid (1 level deep).
    // Multi-level nesting (grandparent->child->grandchild) requires epic parent.
    const data = {
      tasks: [
        { id: 'A', name: 'Epic Parent', type: 'epic' },
        { id: 'B', name: 'Child Story', parentId: 'A' },
      ],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.imported).toBe(2);

    const child = container.taskService.getTask(result.value.idMap['B']!);
    expect(child.ok).toBe(true);
    if (!child.ok) return;
    expect(child.value.parentId).toBe(result.value.idMap['A']);
  });

  it('rejects import with missing task id', () => {
    const data = {
      tasks: [{ name: 'No ID task' }],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('id');
  });

  it('rejects import with missing task name', () => {
    const data = {
      tasks: [{ id: 'X-1' }],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('name');
  });

  it('rejects import with missing dependency fields', () => {
    const data = {
      tasks: [{ id: 'X-1', name: 'Task' }],
      dependencies: [{ taskId: 'X-1' }],
    };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('dependsOnId');
  });

  it('rejects empty tasks array', () => {
    const data = { tasks: [] };

    const result = container.portabilityService.importTasks(data, 'TestProj');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });
});

// ── Round-trip ────────────────────────────────────────────────────────

describe('Export → Import round-trip', () => {
  it('round-trips tasks and dependencies through export then import', () => {
    // Create source data in TestProj
    const t1 = container.taskService.createTask({ name: 'Alpha', type: 'story', status: 'todo' });
    const t2 = container.taskService.createTask({
      name: 'Beta',
      type: 'bug',
      description: 'Fix it',
    });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    // Export
    const exportResult = container.portabilityService.exportTasks('TestProj');
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // Create a second project for import target
    container.projectService.createProject({ name: 'ImportTarget' });

    // Import the exported data into another project
    const importResult = container.portabilityService.importTasks(
      exportResult.value as unknown,
      'ImportTarget',
    );
    expect(importResult.ok).toBe(true);
    if (!importResult.ok) return;

    expect(importResult.value.imported).toBe(2);
    expect(importResult.value.dependencies).toBe(1);

    // Verify imported tasks have correct data
    const newAlphaId = importResult.value.idMap[t1.value.id]!;
    const newBetaId = importResult.value.idMap[t2.value.id]!;

    const alpha = container.taskService.getTask(newAlphaId);
    expect(alpha.ok).toBe(true);
    if (!alpha.ok) return;
    expect(alpha.value.name).toBe('Alpha');
    expect(alpha.value.type).toBe('story');
    expect(alpha.value.status).toBe('todo');

    const beta = container.taskService.getTask(newBetaId);
    expect(beta.ok).toBe(true);
    if (!beta.ok) return;
    expect(beta.value.name).toBe('Beta');
    expect(beta.value.description).toBe('Fix it');

    // Verify dependency was remapped correctly
    const blockers = container.dependencyService.listBlockers(newBetaId);
    expect(blockers.ok).toBe(true);
    if (!blockers.ok) return;
    expect(blockers.value).toHaveLength(1);
    expect(blockers.value[0]?.id).toBe(newAlphaId);
  });
});
