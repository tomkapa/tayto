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
  container.projectService.createProject({ name: 'Proj', isDefault: true });
});

describe('FTS5 Search', () => {
  it('finds tasks by name tokens', () => {
    container.taskService.createTask({ name: 'Fix login authentication bug' });
    container.taskService.createTask({ name: 'Add dashboard widget' });
    container.taskService.createTask({ name: 'Update login page styles' });

    const result = container.taskService.searchTasks('login');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((r) => r.task.name)).toContain('Fix login authentication bug');
    expect(result.value.map((r) => r.task.name)).toContain('Update login page styles');
  });

  it('supports prefix search', () => {
    container.taskService.createTask({ name: 'Authentication module' });
    container.taskService.createTask({ name: 'Authorization rules' });
    container.taskService.createTask({ name: 'Billing system' });

    const result = container.taskService.searchTasks('auth');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it('searches across description and technical notes', () => {
    container.taskService.createTask({
      name: 'Task A',
      description: 'JWT token refresh is broken',
    });
    container.taskService.createTask({
      name: 'Task B',
      technicalNotes: 'Check JWT expiry logic',
    });
    container.taskService.createTask({ name: 'Task C', description: 'Unrelated work' });

    const result = container.taskService.searchTasks('JWT');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((r) => r.task.name).sort()).toEqual(['Task A', 'Task B']);
  });

  it('returns results ranked by relevance', () => {
    // Task with "login" in name should rank higher than in description
    container.taskService.createTask({ name: 'Fix login bug' });
    container.taskService.createTask({
      name: 'Task B',
      description: 'Something about login in the description',
    });

    const result = container.taskService.searchTasks('login');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    // bm25 returns negative values; more negative = better match
    expect(result.value[0]!.rank).toBeLessThanOrEqual(result.value[1]!.rank);
  });

  it('supports multi-word search', () => {
    container.taskService.createTask({ name: 'Fix login authentication bug' });
    container.taskService.createTask({ name: 'Login page redesign' });
    container.taskService.createTask({ name: 'Fix payment bug' });

    const result = container.taskService.searchTasks('fix bug');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both words must match (prefix) somewhere in the task
    expect(result.value.length).toBeGreaterThanOrEqual(1);
    expect(result.value.map((r) => r.task.name)).toContain('Fix login authentication bug');
  });

  it('scopes search to a project', () => {
    const p2 = container.projectService.createProject({ name: 'Other' });
    if (!p2.ok) throw new Error('setup failed');

    container.taskService.createTask({ name: 'Login fix in default' });
    container.taskService.createTask({ name: 'Login fix in other' }, 'Other');

    const result = container.taskService.searchTasks('login', 'Other');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.task.name).toBe('Login fix in other');
  });

  it('returns empty for no matches', () => {
    container.taskService.createTask({ name: 'Some task' });

    const result = container.taskService.searchTasks('nonexistent');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('rejects empty query', () => {
    const result = container.taskService.searchTasks('  ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('FTS index stays in sync after task update', () => {
    const t = container.taskService.createTask({ name: 'Original name' });
    if (!t.ok) throw new Error('setup failed');

    container.taskService.updateTask(t.value.id, { name: 'Updated name with keyword' });

    const oldResult = container.taskService.searchTasks('Original');
    expect(oldResult.ok).toBe(true);
    if (!oldResult.ok) return;
    expect(oldResult.value).toHaveLength(0);

    const newResult = container.taskService.searchTasks('keyword');
    expect(newResult.ok).toBe(true);
    if (!newResult.ok) return;
    expect(newResult.value).toHaveLength(1);
  });

  it('FTS index stays in sync after task delete', () => {
    const t = container.taskService.createTask({ name: 'Deletable task' });
    if (!t.ok) throw new Error('setup failed');

    container.taskService.deleteTask(t.value.id);

    const result = container.taskService.searchTasks('Deletable');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('existing task list --search still works with FTS', () => {
    container.taskService.createTask({ name: 'Fix login bug' });
    container.taskService.createTask({ name: 'Add dashboard' });

    const result = container.taskService.listTasks({ search: 'login' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('Fix login bug');
  });
});
