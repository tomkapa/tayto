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
    const parent = container.taskService.createTask({ name: 'Parent', type: 'epic' });
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

    it('allows using a non-backlog task as anchor (--after/--before)', () => {
      const t1 = container.taskService.createTask({ name: 'Todo task' });
      const t2 = container.taskService.createTask({ name: 'Backlog task' });
      if (!t1.ok || !t2.ok) throw new Error('setup failed');

      // Move t1 to 'todo' status
      const updated = container.taskService.updateTask(t1.value.id, { status: 'todo' });
      expect(updated.ok).toBe(true);

      // Rerank t2 after t1 (which is now 'todo', not 'backlog')
      const result = container.taskService.rerankTask({
        taskId: t2.value.id,
        afterId: t1.value.id,
      });
      expect(result.ok).toBe(true);
    });

    it('allows using an in-progress task as anchor (--before)', () => {
      const t1 = container.taskService.createTask({ name: 'In-progress task' });
      const t2 = container.taskService.createTask({ name: 'Backlog task' });
      if (!t1.ok || !t2.ok) throw new Error('setup failed');

      container.taskService.updateTask(t1.value.id, { status: 'in-progress' });

      const result = container.taskService.rerankTask({
        taskId: t2.value.id,
        beforeId: t1.value.id,
      });
      expect(result.ok).toBe(true);
    });

    it('rejects terminal task as anchor', () => {
      const t1 = container.taskService.createTask({ name: 'Done task' });
      const t2 = container.taskService.createTask({ name: 'Backlog task' });
      if (!t1.ok || !t2.ok) throw new Error('setup failed');

      container.taskService.updateTask(t1.value.id, { status: 'done' });

      const result = container.taskService.rerankTask({
        taskId: t2.value.id,
        afterId: t1.value.id,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('epic type and level system', () => {
    it('creates an epic task', () => {
      const result = container.taskService.createTask({ name: 'My Epic', type: 'epic' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('epic');
      expect(result.value.parentId).toBeNull();
    });

    it('rejects epic with a parentId', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');

      const result = container.taskService.createTask({
        name: 'Nested Epic',
        type: 'epic',
        parentId: epic.value.id,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cannot have a parent');
    });

    it('allows level 2 task as child of epic', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');

      const story = container.taskService.createTask({
        name: 'Story',
        type: 'story',
        parentId: epic.value.id,
      });
      expect(story.ok).toBe(true);
      if (!story.ok) return;
      expect(story.value.parentId).toBe(epic.value.id);
    });

    it('rejects level 2 task as child of another level 2 task', () => {
      const story = container.taskService.createTask({ name: 'Parent Story', type: 'story' });
      if (!story.ok) throw new Error('setup failed');

      const result = container.taskService.createTask({
        name: 'Child Story',
        type: 'story',
        parentId: story.value.id,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('epic-level');
    });

    it('rejects changing epic to story when it has children', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');
      container.taskService.createTask({
        name: 'Child',
        type: 'story',
        parentId: epic.value.id,
      });

      const result = container.taskService.updateTask(epic.value.id, { type: 'story' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('has children');
    });

    it('allows changing epic to story when it has no children', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');

      const result = container.taskService.updateTask(epic.value.id, { type: 'story' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('story');
    });

    it('rejects changing to epic when task has a parent', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');
      const story = container.taskService.createTask({
        name: 'Story',
        type: 'story',
        parentId: epic.value.id,
      });
      if (!story.ok) throw new Error('setup failed');

      const result = container.taskService.updateTask(story.value.id, { type: 'epic' });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('has a parent');
    });

    it('ranks epics separately from stories', () => {
      const e1 = container.taskService.createTask({ name: 'Epic 1', type: 'epic' });
      const s1 = container.taskService.createTask({ name: 'Story 1', type: 'story' });
      const e2 = container.taskService.createTask({ name: 'Epic 2', type: 'epic' });
      const s2 = container.taskService.createTask({ name: 'Story 2', type: 'story' });
      if (!e1.ok || !s1.ok || !e2.ok || !s2.ok) throw new Error('setup failed');

      // Epics should be ranked independently of stories
      expect(e1.value.rank).toBeLessThan(e2.value.rank);
      expect(s1.value.rank).toBeLessThan(s2.value.rank);
    });

    it('lists tasks filtered by level', () => {
      container.taskService.createTask({ name: 'Epic', type: 'epic' });
      container.taskService.createTask({ name: 'Story', type: 'story' });
      container.taskService.createTask({ name: 'Bug', type: 'bug' });

      // Level 1 = epics only
      const epics = container.taskService.listTasks({ level: 1 });
      expect(epics.ok).toBe(true);
      if (!epics.ok) return;
      expect(epics.value).toHaveLength(1);
      expect(epics.value[0]?.type).toBe('epic');

      // Level 2 = stories, tech-debt, bugs
      const work = container.taskService.listTasks({ level: 2 });
      expect(work.ok).toBe(true);
      if (!work.ok) return;
      expect(work.value).toHaveLength(2);
      expect(work.value.every((t) => t.type !== 'epic')).toBe(true);
    });

    it('lists tasks filtered by parentIds (multi-select)', () => {
      const e1 = container.taskService.createTask({ name: 'Epic 1', type: 'epic' });
      const e2 = container.taskService.createTask({ name: 'Epic 2', type: 'epic' });
      if (!e1.ok || !e2.ok) throw new Error('setup failed');

      container.taskService.createTask({ name: 'S1', parentId: e1.value.id });
      container.taskService.createTask({ name: 'S2', parentId: e2.value.id });
      container.taskService.createTask({ name: 'S3' }); // no parent

      const result = container.taskService.listTasks({
        parentIds: [e1.value.id, e2.value.id],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value.map((t) => t.name).sort()).toEqual(['S1', 'S2']);
    });

    it('breakdown rejects non-epic parent', () => {
      const story = container.taskService.createTask({ name: 'Story', type: 'story' });
      if (!story.ok) throw new Error('setup failed');

      const result = container.taskService.breakdownTask(story.value.id, [
        { name: 'Sub', type: 'story' },
      ]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('epic-level');
    });

    it('breakdown rejects epic subtask', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');

      const result = container.taskService.breakdownTask(epic.value.id, [
        { name: 'Sub Epic', type: 'epic' },
      ]);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('cannot be an epic');
    });

    it('breakdown succeeds with epic parent and work subtasks', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      if (!epic.ok) throw new Error('setup failed');

      const result = container.taskService.breakdownTask(epic.value.id, [
        { name: 'Sub 1', type: 'story' },
        { name: 'Sub 2', type: 'bug' },
      ]);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value.every((t) => t.parentId === epic.value.id)).toBe(true);
    });

    it('rejects reranking epic with --after pointing to a story', () => {
      const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
      const story = container.taskService.createTask({ name: 'Story', type: 'story' });
      if (!epic.ok || !story.ok) throw new Error('setup failed');

      // story is not in the epic-level ranked list, so it won't be found
      const result = container.taskService.rerankTask({
        taskId: epic.value.id,
        afterId: story.value.id,
      });
      expect(result.ok).toBe(false);
    });

    it('auto-reranks done epic to bottom of epic level', () => {
      const e1 = container.taskService.createTask({ name: 'Epic 1', type: 'epic' });
      const e2 = container.taskService.createTask({ name: 'Epic 2', type: 'epic' });
      if (!e1.ok || !e2.ok) throw new Error('setup failed');

      // Mark e1 as done
      const result = container.taskService.updateTask(e1.value.id, { status: 'done' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // e1 should now have a higher rank than e2 (moved to bottom)
      expect(result.value.rank).toBeGreaterThan(e2.value.rank);
    });

    it('rejects setting parentId on epic via update', () => {
      const e1 = container.taskService.createTask({ name: 'Epic 1', type: 'epic' });
      const e2 = container.taskService.createTask({ name: 'Epic 2', type: 'epic' });
      if (!e1.ok || !e2.ok) throw new Error('setup failed');

      const result = container.taskService.updateTask(e1.value.id, {
        parentId: e2.value.id,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain('cannot have a parent');
    });

    describe('auto-propagate parent status', () => {
      it('moves epic to in-progress when first child starts', () => {
        const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
        if (!epic.ok) throw new Error('setup failed');
        const s1 = container.taskService.createTask({
          name: 'S1',
          parentId: epic.value.id,
        });
        const s2 = container.taskService.createTask({
          name: 'S2',
          parentId: epic.value.id,
        });
        if (!s1.ok || !s2.ok) throw new Error('setup failed');

        // Epic starts as backlog
        expect(epic.value.status).toBe('backlog');

        // Move first child to in-progress
        container.taskService.updateTask(s1.value.id, { status: 'in-progress' });

        const updated = container.taskService.getTask(epic.value.id);
        expect(updated.ok).toBe(true);
        if (!updated.ok) return;
        expect(updated.value.status).toBe('in-progress');
      });

      it('does not demote epic when second child also starts', () => {
        const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
        if (!epic.ok) throw new Error('setup failed');
        const s1 = container.taskService.createTask({
          name: 'S1',
          parentId: epic.value.id,
        });
        const s2 = container.taskService.createTask({
          name: 'S2',
          parentId: epic.value.id,
        });
        if (!s1.ok || !s2.ok) throw new Error('setup failed');

        container.taskService.updateTask(s1.value.id, { status: 'in-progress' });
        container.taskService.updateTask(s2.value.id, { status: 'in-progress' });

        const updated = container.taskService.getTask(epic.value.id);
        expect(updated.ok).toBe(true);
        if (!updated.ok) return;
        expect(updated.value.status).toBe('in-progress');
      });

      it('moves epic to done when all children are terminal', () => {
        const epic = container.taskService.createTask({ name: 'Epic', type: 'epic' });
        if (!epic.ok) throw new Error('setup failed');
        const s1 = container.taskService.createTask({
          name: 'S1',
          parentId: epic.value.id,
        });
        const s2 = container.taskService.createTask({
          name: 'S2',
          parentId: epic.value.id,
        });
        if (!s1.ok || !s2.ok) throw new Error('setup failed');

        container.taskService.updateTask(s1.value.id, { status: 'done' });
        // Epic should still not be done yet (s2 is still backlog)
        let updated = container.taskService.getTask(epic.value.id);
        expect(updated.ok).toBe(true);
        if (!updated.ok) return;
        expect(updated.value.status).not.toBe('done');

        container.taskService.updateTask(s2.value.id, { status: 'cancelled' });
        // Now all children are terminal → epic should be done
        updated = container.taskService.getTask(epic.value.id);
        expect(updated.ok).toBe(true);
        if (!updated.ok) return;
        expect(updated.value.status).toBe('done');
      });

      it('does not propagate for tasks without a parent', () => {
        const s1 = container.taskService.createTask({ name: 'Orphan' });
        if (!s1.ok) throw new Error('setup failed');
        // Should not throw
        const result = container.taskService.updateTask(s1.value.id, { status: 'in-progress' });
        expect(result.ok).toBe(true);
      });

      it('moves epic from todo to in-progress on child start', () => {
        const epic = container.taskService.createTask({
          name: 'Epic',
          type: 'epic',
          status: 'todo',
        });
        if (!epic.ok) throw new Error('setup failed');
        const s1 = container.taskService.createTask({
          name: 'S1',
          parentId: epic.value.id,
        });
        if (!s1.ok) throw new Error('setup failed');

        container.taskService.updateTask(s1.value.id, { status: 'in-progress' });

        const updated = container.taskService.getTask(epic.value.id);
        expect(updated.ok).toBe(true);
        if (!updated.ok) return;
        expect(updated.value.status).toBe('in-progress');
      });
    });
  });
});
