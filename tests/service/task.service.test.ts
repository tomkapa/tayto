import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';

let container: Container;

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
});

describe('ProjectService', () => {
  it('creates and retrieves a project', () => {
    const result = container.projectService.createProject({
      name: 'Test Project',
      description: 'A test project',
      isDefault: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Test Project');
    expect(result.value.isDefault).toBe(true);
  });

  it('lists projects', () => {
    const baseline = container.projectService.listProjects();
    if (!baseline.ok) throw new Error('setup failed');
    const baseCount = baseline.value.length;

    container.projectService.createProject({ name: 'P1' });
    container.projectService.createProject({ name: 'P2' });
    const result = container.projectService.listProjects();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(baseCount + 2);
  });

  it('rejects duplicate project names', () => {
    container.projectService.createProject({ name: 'P1' });
    const result = container.projectService.createProject({ name: 'P1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DUPLICATE');
  });

  it('resolves default project', () => {
    container.projectService.createProject({ name: 'Default', isDefault: true });
    const result = container.projectService.resolveProject();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Default');
  });

  it('resolves project by name', () => {
    container.projectService.createProject({ name: 'Named' });
    const result = container.projectService.resolveProject('Named');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Named');
  });
});

describe('TaskService', () => {
  beforeEach(() => {
    container.projectService.createProject({ name: 'Proj', isDefault: true });
  });

  it('creates a task in the default project', () => {
    const result = container.taskService.createTask({ name: 'My task' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('My task');
    expect(result.value.type).toBe('story');
    expect(result.value.status).toBe('backlog');
    expect(result.value.rank).toBeGreaterThan(0);
  });

  it('creates a task with all fields', () => {
    const result = container.taskService.createTask({
      name: 'Full task',
      description: 'Description here',
      type: 'bug',
      status: 'todo',
      technicalNotes: 'Some notes',
      additionalRequirements: 'Some reqs',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('bug');
    expect(result.value.technicalNotes).toBe('Some notes');
  });

  it('creates a task with typed dependsOn entries', () => {
    const t1 = container.taskService.createTask({ name: 'Dep target 1' });
    const t2 = container.taskService.createTask({ name: 'Dep target 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    const result = container.taskService.createTask({
      name: 'Task with deps',
      dependsOn: [
        { id: t1.value.id, type: 'blocks' },
        { id: t2.value.id, type: 'relates-to' },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Verify the dependency types were preserved
    const deps = container.dependencyService.listAllDeps(result.value.id);
    expect(deps.ok).toBe(true);
    if (!deps.ok) return;
    expect(deps.value).toHaveLength(2);

    const byTarget = new Map(deps.value.map((d) => [d.dependsOnId, d.type]));
    expect(byTarget.get(t1.value.id)).toBe('blocks');
    expect(byTarget.get(t2.value.id)).toBe('relates-to');
  });

  it('assigns increasing ranks to new tasks', () => {
    const r1 = container.taskService.createTask({ name: 'Task 1' });
    const r2 = container.taskService.createTask({ name: 'Task 2' });
    const r3 = container.taskService.createTask({ name: 'Task 3' });
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error('setup failed');
    expect(r1.value.rank).toBeLessThan(r2.value.rank);
    expect(r2.value.rank).toBeLessThan(r3.value.rank);
  });

  it('lists tasks with filters', () => {
    container.taskService.createTask({ name: 'Bug 1', type: 'bug' });
    container.taskService.createTask({ name: 'Story 1', type: 'story' });
    container.taskService.createTask({ name: 'Bug 2', type: 'bug' });

    const result = container.taskService.listTasks({ type: 'bug' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.every((t) => t.type === 'bug')).toBe(true);
  });

  it('searches tasks by text', () => {
    container.taskService.createTask({ name: 'Fix login bug' });
    container.taskService.createTask({ name: 'Add dashboard' });

    const result = container.taskService.listTasks({ search: 'login' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.name).toBe('Fix login bug');
  });

  it('updates a task', () => {
    const created = container.taskService.createTask({ name: 'Original' });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.updateTask(created.value.id, {
      name: 'Updated',
      status: 'in-progress',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Updated');
    expect(result.value.status).toBe('in-progress');
  });

  it('rejects transitioning to in-progress when non-terminal blockers exist', () => {
    const blocker = container.taskService.createTask({ name: 'Blocker' });
    const blocked = container.taskService.createTask({ name: 'Blocked' });
    if (!blocker.ok || !blocked.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: blocked.value.id,
      dependsOnId: blocker.value.id,
    });

    const result = container.taskService.updateTask(blocked.value.id, { status: 'in-progress' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('blocked');
  });

  it('allows transitioning to in-progress when all blockers are terminal', () => {
    const blocker = container.taskService.createTask({ name: 'Blocker' });
    const blocked = container.taskService.createTask({ name: 'Blocked' });
    if (!blocker.ok || !blocked.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: blocked.value.id,
      dependsOnId: blocker.value.id,
    });

    // Mark blocker as done
    container.taskService.updateTask(blocker.value.id, { status: 'done' });

    const result = container.taskService.updateTask(blocked.value.id, { status: 'in-progress' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('in-progress');
  });

  it('appends to technical notes', () => {
    const created = container.taskService.createTask({
      name: 'Task',
      technicalNotes: 'Initial note',
    });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.updateTask(created.value.id, {
      appendNotes: 'Follow-up note',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.technicalNotes).toContain('Initial note');
    expect(result.value.technicalNotes).toContain('Follow-up note');
    expect(result.value.technicalNotes).toContain('---');
  });

  it('deletes a task', () => {
    const created = container.taskService.createTask({ name: 'To delete' });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.deleteTask(created.value.id);
    expect(result.ok).toBe(true);

    const get = container.taskService.getTask(created.value.id);
    expect(get.ok).toBe(false);
  });

  it('soft-deletes: task disappears from list but dependency edges survive', () => {
    const t1 = container.taskService.createTask({ name: 'Blocker' });
    const t2 = container.taskService.createTask({ name: 'Blocked' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    // Soft-delete the blocker
    container.taskService.deleteTask(t1.value.id);

    // Blocker no longer appears in task list
    const list = container.taskService.listTasks({ status: 'backlog' });
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value.find((t) => t.id === t1.value.id)).toBeUndefined();

    // Blocker no longer appears in blockers (filtered out)
    const blockers = container.dependencyService.listBlockers(t2.value.id);
    expect(blockers.ok).toBe(true);
    if (!blockers.ok) return;
    expect(blockers.value).toHaveLength(0);

    // The blocked task is still accessible
    const get = container.taskService.getTask(t2.value.id);
    expect(get.ok).toBe(true);
  });

  it('soft-deletes: double delete returns NOT_FOUND', () => {
    const created = container.taskService.createTask({ name: 'Task' });
    if (!created.ok) throw new Error('setup failed');

    container.taskService.deleteTask(created.value.id);
    const result = container.taskService.deleteTask(created.value.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('breaks down a task into subtasks', () => {
    const parent = container.taskService.createTask({ name: 'Parent' });
    if (!parent.ok) throw new Error('setup failed');

    const result = container.taskService.breakdownTask(parent.value.id, [
      { name: 'Subtask 1', type: 'story' },
      { name: 'Subtask 2', type: 'bug' },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]?.parentId).toBe(parent.value.id);
    expect(result.value[1]?.type).toBe('bug');
  });

  it('rejects invalid task type', () => {
    const result = container.taskService.createTask({
      name: 'Bad task',
      type: 'invalid' as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('returns NOT_FOUND for missing task', () => {
    const result = container.taskService.getTask('nonexistent');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  describe('rerankTask', () => {
    it('re-ranks a task to a specific position', () => {
      const t1 = container.taskService.createTask({ name: 'Task 1' });
      const t2 = container.taskService.createTask({ name: 'Task 2' });
      const t3 = container.taskService.createTask({ name: 'Task 3' });
      if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

      // Move task 3 to position 1
      const result = container.taskService.rerankTask({
        taskId: t3.value.id,
        position: 1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const list = container.taskService.listTasks({ status: 'backlog' });
      if (!list.ok) throw new Error('list failed');
      expect(list.value[0]?.name).toBe('Task 3');
    });

    it('re-ranks a task after another', () => {
      const t1 = container.taskService.createTask({ name: 'Task 1' });
      const t2 = container.taskService.createTask({ name: 'Task 2' });
      const t3 = container.taskService.createTask({ name: 'Task 3' });
      if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

      // Move task 3 after task 1
      const result = container.taskService.rerankTask({
        taskId: t3.value.id,
        afterId: t1.value.id,
      });
      expect(result.ok).toBe(true);

      const list = container.taskService.listTasks({ status: 'backlog' });
      if (!list.ok) throw new Error('list failed');
      expect(list.value[0]?.name).toBe('Task 1');
      expect(list.value[1]?.name).toBe('Task 3');
      expect(list.value[2]?.name).toBe('Task 2');
    });

    it('re-ranks a task before another', () => {
      const t1 = container.taskService.createTask({ name: 'Task 1' });
      const t2 = container.taskService.createTask({ name: 'Task 2' });
      const t3 = container.taskService.createTask({ name: 'Task 3' });
      if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

      // Move task 3 before task 1
      const result = container.taskService.rerankTask({
        taskId: t3.value.id,
        beforeId: t1.value.id,
      });
      expect(result.ok).toBe(true);

      const list = container.taskService.listTasks({ status: 'backlog' });
      if (!list.ok) throw new Error('list failed');
      expect(list.value[0]?.name).toBe('Task 3');
      expect(list.value[1]?.name).toBe('Task 1');
    });

    it('rejects when no positioning option given', () => {
      const t1 = container.taskService.createTask({ name: 'Task 1' });
      if (!t1.ok) throw new Error('setup failed');

      const result = container.taskService.rerankTask({ taskId: t1.value.id });
      expect(result.ok).toBe(false);
    });

    it('rejects moving a blocked task above its blocker', () => {
      // t1 at rank 1000, t2 at rank 2000; t2 depends on t1
      const t1 = container.taskService.createTask({ name: 'Blocker' });
      const t2 = container.taskService.createTask({ name: 'Blocked' });
      if (!t1.ok || !t2.ok) throw new Error('setup failed');

      container.dependencyService.addDependency({
        taskId: t2.value.id,
        dependsOnId: t1.value.id,
      });

      // Try to move t2 to position 1 (above its blocker t1)
      const result = container.taskService.rerankTask({
        taskId: t2.value.id,
        position: 1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('blocker');
    });

    it('rejects moving a blocker below its dependent', () => {
      // t1 at rank 1000, t2 at rank 2000; t2 depends on t1
      const t1 = container.taskService.createTask({ name: 'Blocker' });
      const t2 = container.taskService.createTask({ name: 'Blocked' });
      if (!t1.ok || !t2.ok) throw new Error('setup failed');

      container.dependencyService.addDependency({
        taskId: t2.value.id,
        dependsOnId: t1.value.id,
      });

      // Try to move t1 to position 2 (below its dependent t2)
      const result = container.taskService.rerankTask({
        taskId: t1.value.id,
        position: 2,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('dependent');
    });

    it('allows reranking when dependency order is preserved', () => {
      const t1 = container.taskService.createTask({ name: 'Blocker' });
      const t2 = container.taskService.createTask({ name: 'Middle' });
      const t3 = container.taskService.createTask({ name: 'Blocked' });
      if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

      // t3 depends on t1
      container.dependencyService.addDependency({
        taskId: t3.value.id,
        dependsOnId: t1.value.id,
      });

      // Move t3 after t2 (still below t1) — should succeed
      const result = container.taskService.rerankTask({
        taskId: t3.value.id,
        afterId: t2.value.id,
      });
      expect(result.ok).toBe(true);
    });
  });
});
