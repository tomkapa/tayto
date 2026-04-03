import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';
import { DependencyType } from '../../src/types/enums.js';

let container: Container;

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
  container.projectService.createProject({ name: 'Proj', isDefault: true });
});

/** Helper: create a task and return its id, throwing on failure. */
function createTask(name: string): string {
  const result = container.taskService.createTask({ name });
  if (!result.ok) throw new Error(`Failed to create task: ${result.error.message}`);
  return result.value.id;
}

/** Helper: add a dependency, throwing on failure. */
function addDep(taskId: string, dependsOnId: string, type: string = DependencyType.Blocks): void {
  const result = container.dependencyService.addDependency({ taskId, dependsOnId, type });
  if (!result.ok) throw new Error(`Failed to add dep: ${result.error.message}`);
}

describe('DependencyService', () => {
  // ─── Basic CRUD ─────────────────────────────────────────────────────

  describe('addDependency', () => {
    it('adds a dependency with default blocks type', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.taskId).toBe(t2);
      expect(result.value.dependsOnId).toBe(t1);
      expect(result.value.type).toBe('blocks');
      expect(result.value.createdAt).toBeTruthy();
    });

    it('adds a relates-to dependency', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
        type: 'relates-to',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('relates-to');
    });

    it('adds a duplicates dependency', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
        type: 'duplicates',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('duplicates');
    });

    it('allows same pair with different dependency already existing (duplicate edge)', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      addDep(t2, t1, 'blocks');
      // Same (taskId, dependsOnId) pair — primary key violation
      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
        type: 'relates-to',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DUPLICATE');
    });
  });

  // ─── Validation errors ──────────────────────────────────────────────

  describe('validation', () => {
    it('rejects self-dependency', () => {
      const t1 = createTask('Task 1');

      const result = container.dependencyService.addDependency({
        taskId: t1,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });

    it('rejects duplicate dependency', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1);

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DUPLICATE');
    });

    it('returns NOT_FOUND when taskId does not exist', () => {
      const t1 = createTask('Task 1');

      const result = container.dependencyService.addDependency({
        taskId: 'nonexistent',
        dependsOnId: t1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns NOT_FOUND when dependsOnId does not exist', () => {
      const t1 = createTask('Task 1');

      const result = container.dependencyService.addDependency({
        taskId: t1,
        dependsOnId: 'nonexistent',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns VALIDATION when taskId is empty', () => {
      const result = container.dependencyService.addDependency({
        taskId: '',
        dependsOnId: 'some-id',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });

    it('returns VALIDATION when dependsOnId is empty', () => {
      const result = container.dependencyService.addDependency({
        taskId: 'some-id',
        dependsOnId: '',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });

    it('returns VALIDATION for invalid dependency type', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
        type: 'invalid-type',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });
  });

  // ─── Cycle detection ────────────────────────────────────────────────

  describe('cycle detection', () => {
    it('detects direct cycle (A -> B, then B -> A)', () => {
      const a = createTask('A');
      const b = createTask('B');
      addDep(b, a); // B depends on A

      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: b,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cycle');
    });

    it('detects transitive cycle of length 3 (A -> B -> C, then C -> A)', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      addDep(b, a); // B depends on A
      addDep(c, b); // C depends on B

      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: c,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cycle');
    });

    it('detects transitive cycle of length 4 (A -> B -> C -> D, then D -> A)', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a);
      addDep(c, b);
      addDep(d, c);

      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: d,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cycle');
    });

    it('allows valid dependency that does not create a cycle', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      addDep(b, a); // B depends on A
      addDep(c, a); // C depends on A

      // C depends on B — no cycle (diamond shape: B->A, C->A, C->B)
      const result = container.dependencyService.addDependency({
        taskId: c,
        dependsOnId: b,
      });
      expect(result.ok).toBe(true);
    });

    it('allows parallel chains without false cycle detection', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a); // Chain 1: B -> A
      addDep(d, c); // Chain 2: D -> C

      // Cross-chain link: D depends on A — no cycle
      const result = container.dependencyService.addDependency({
        taskId: d,
        dependsOnId: a,
      });
      expect(result.ok).toBe(true);
    });

    it('detects cycle in diamond shape when closing the loop', () => {
      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a); // B depends on A
      addDep(c, a); // C depends on A
      addDep(d, b); // D depends on B
      addDep(d, c); // D depends on C

      // A depends on D would close: A -> D -> B -> A
      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: d,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cycle');
    });

    it('detects cycle when middle node creates shortcut', () => {
      // A -> B -> C, then B -> A (cycle via middle)
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      addDep(b, a);
      addDep(c, b);

      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: b,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
      expect(result.error.message).toContain('cycle');
    });
  });

  // ─── removeDependency ───────────────────────────────────────────────

  describe('removeDependency', () => {
    it('removes an existing dependency', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1);

      const result = container.dependencyService.removeDependency({
        taskId: t2,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(true);

      const deps = container.dependencyService.listAllDeps(t2);
      expect(deps.ok).toBe(true);
      if (!deps.ok) return;
      expect(deps.value).toHaveLength(0);
    });

    it('returns NOT_FOUND when removing non-existent dependency', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');

      const result = container.dependencyService.removeDependency({
        taskId: t2,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns VALIDATION when taskId is empty', () => {
      const result = container.dependencyService.removeDependency({
        taskId: '',
        dependsOnId: 'some-id',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });

    it('returns VALIDATION when dependsOnId is empty', () => {
      const result = container.dependencyService.removeDependency({
        taskId: 'some-id',
        dependsOnId: '',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION');
    });

    it('only removes the specified edge, leaving others intact', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      addDep(c, a);
      addDep(c, b);

      container.dependencyService.removeDependency({ taskId: c, dependsOnId: a });

      const deps = container.dependencyService.listAllDeps(c);
      expect(deps.ok).toBe(true);
      if (!deps.ok) return;
      expect(deps.value).toHaveLength(1);
      expect(deps.value[0]!.dependsOnId).toBe(b);
    });

    it('allows re-adding a dependency after removal', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1);
      container.dependencyService.removeDependency({ taskId: t2, dependsOnId: t1 });

      const result = container.dependencyService.addDependency({
        taskId: t2,
        dependsOnId: t1,
      });
      expect(result.ok).toBe(true);
    });

    it('removing a dependency breaks cycle detection for that edge', () => {
      const a = createTask('A');
      const b = createTask('B');
      addDep(b, a); // B depends on A

      // A depends on B would be a cycle
      const cycleResult = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: b,
      });
      expect(cycleResult.ok).toBe(false);

      // Remove B -> A edge
      container.dependencyService.removeDependency({ taskId: b, dependsOnId: a });

      // Now A depends on B is allowed
      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: b,
      });
      expect(result.ok).toBe(true);
    });
  });

  // ─── Listing dependencies ───────────────────────────────────────────

  describe('listBlockers', () => {
    it('returns tasks that block the given task', () => {
      const blocker1 = createTask('Blocker 1');
      const blocker2 = createTask('Blocker 2');
      const blocked = createTask('Blocked');
      addDep(blocked, blocker1);
      addDep(blocked, blocker2);

      const result = container.dependencyService.listBlockers(blocked);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value.map((t) => t.name).sort()).toEqual(['Blocker 1', 'Blocker 2']);
    });

    it('returns empty array when task has no blockers', () => {
      const t1 = createTask('Standalone');

      const result = container.dependencyService.listBlockers(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('does not include relates-to or duplicates in blockers', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');
      addDep(t3, t1, 'relates-to');
      addDep(t3, t2, 'blocks');

      const result = container.dependencyService.listBlockers(t3);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.name).toBe('Task 2');
    });
  });

  describe('listDependents', () => {
    it('returns tasks that depend on the given task', () => {
      const foundation = createTask('Foundation');
      const dep1 = createTask('Dependent 1');
      const dep2 = createTask('Dependent 2');
      addDep(dep1, foundation);
      addDep(dep2, foundation);

      const result = container.dependencyService.listDependents(foundation);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('returns empty array when nothing depends on the task', () => {
      const t1 = createTask('Leaf');

      const result = container.dependencyService.listDependents(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('does not include relates-to or duplicates in dependents', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');
      addDep(t2, t1, 'relates-to');
      addDep(t3, t1, 'blocks');

      const result = container.dependencyService.listDependents(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.name).toBe('Task 3');
    });
  });

  describe('listRelated', () => {
    it('returns bidirectional relates-to tasks', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t1, t2, 'relates-to');

      // Should appear from both sides
      const fromT1 = container.dependencyService.listRelated(t1);
      expect(fromT1.ok).toBe(true);
      if (!fromT1.ok) return;
      expect(fromT1.value).toHaveLength(1);
      expect(fromT1.value[0]!.id).toBe(t2);

      const fromT2 = container.dependencyService.listRelated(t2);
      expect(fromT2.ok).toBe(true);
      if (!fromT2.ok) return;
      expect(fromT2.value).toHaveLength(1);
      expect(fromT2.value[0]!.id).toBe(t1);
    });

    it('returns empty array when no related tasks exist', () => {
      const t1 = createTask('Standalone');

      const result = container.dependencyService.listRelated(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('does not include blocks or duplicates', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');
      addDep(t2, t1, 'blocks');
      addDep(t3, t1, 'relates-to');

      const result = container.dependencyService.listRelated(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.id).toBe(t3);
    });
  });

  describe('listDuplicates', () => {
    it('returns bidirectional duplicate tasks', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t1, t2, 'duplicates');

      const fromT1 = container.dependencyService.listDuplicates(t1);
      expect(fromT1.ok).toBe(true);
      if (!fromT1.ok) return;
      expect(fromT1.value).toHaveLength(1);
      expect(fromT1.value[0]!.id).toBe(t2);

      const fromT2 = container.dependencyService.listDuplicates(t2);
      expect(fromT2.ok).toBe(true);
      if (!fromT2.ok) return;
      expect(fromT2.value).toHaveLength(1);
      expect(fromT2.value[0]!.id).toBe(t1);
    });

    it('returns empty array when no duplicates exist', () => {
      const t1 = createTask('Standalone');

      const result = container.dependencyService.listDuplicates(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('does not include blocks or relates-to', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');
      addDep(t2, t1, 'blocks');
      addDep(t3, t1, 'duplicates');

      const result = container.dependencyService.listDuplicates(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.id).toBe(t3);
    });
  });

  describe('listAllDeps', () => {
    it('returns all dependency edges for a task regardless of type', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');
      addDep(t1, t2, 'blocks');
      addDep(t1, t3, 'relates-to');

      const result = container.dependencyService.listAllDeps(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
    });

    it('returns empty array for task with no dependencies', () => {
      const t1 = createTask('Standalone');

      const result = container.dependencyService.listAllDeps(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('only returns outgoing edges (not incoming)', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1); // t2 depends on t1

      // t1 has no outgoing edges
      const t1Deps = container.dependencyService.listAllDeps(t1);
      expect(t1Deps.ok).toBe(true);
      if (!t1Deps.ok) return;
      expect(t1Deps.value).toHaveLength(0);

      // t2 has one outgoing edge
      const t2Deps = container.dependencyService.listAllDeps(t2);
      expect(t2Deps.ok).toBe(true);
      if (!t2Deps.ok) return;
      expect(t2Deps.value).toHaveLength(1);
    });
  });

  // ─── Transitive dependencies ────────────────────────────────────────

  describe('getTransitiveDeps', () => {
    it('returns all transitive blockers in a chain', () => {
      const a = createTask('Root');
      const b = createTask('Middle');
      const c = createTask('Leaf');
      addDep(b, a); // B depends on A
      addDep(c, b); // C depends on B

      const result = container.dependencyService.getTransitiveDeps(c);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(2);
      expect(result.value.map((t) => t.name).sort()).toEqual(['Middle', 'Root']);
    });

    it('returns transitive deps in a deep chain (4 levels)', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a);
      addDep(c, b);
      addDep(d, c);

      const result = container.dependencyService.getTransitiveDeps(d);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(3);
      expect(result.value.map((t) => t.name).sort()).toEqual(['A', 'B', 'C']);
    });

    it('returns empty array when task has no dependencies', () => {
      const t1 = createTask('Standalone');

      const result = container.dependencyService.getTransitiveDeps(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('handles diamond-shaped dependency graph without duplicates', () => {
      //   A
      //  / \
      // B   C
      //  \ /
      //   D
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a);
      addDep(c, a);
      addDep(d, b);
      addDep(d, c);

      const result = container.dependencyService.getTransitiveDeps(d);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // A, B, C — no duplicates
      expect(result.value).toHaveLength(3);
      expect(result.value.map((t) => t.name).sort()).toEqual(['A', 'B', 'C']);
    });

    it('returns only direct dep when no chain exists', () => {
      const a = createTask('A');
      const b = createTask('B');
      addDep(b, a);

      const result = container.dependencyService.getTransitiveDeps(b);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(1);
      expect(result.value[0]!.name).toBe('A');
    });
  });

  // ─── buildGraph ─────────────────────────────────────────────────────

  describe('buildGraph', () => {
    it('builds a graph with mermaid output for a chain', () => {
      const a = createTask('Task A');
      const b = createTask('Task B');
      const c = createTask('Task C');
      addDep(b, a);
      addDep(c, b);

      const result = container.dependencyService.buildGraph(b);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.nodes).toHaveLength(3);
      expect(result.value.edges).toHaveLength(2);
      expect(result.value.mermaid).toContain('graph LR');
      expect(result.value.mermaid).toContain('blocks');
    });

    it('highlights the root task in mermaid output', () => {
      const a = createTask('Task A');
      const b = createTask('Task B');
      addDep(b, a);

      const result = container.dependencyService.buildGraph(b);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The highlighted node uses round brackets (...) and :::highlight
      expect(result.value.mermaid).toContain(`${b}(`);
      expect(result.value.mermaid).toContain(':::highlight');
    });

    it('returns NOT_FOUND for non-existent task', () => {
      const result = container.dependencyService.buildGraph('nonexistent');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });

    it('returns graph with single node when task has no dependencies', () => {
      const t1 = createTask('Isolated');

      const result = container.dependencyService.buildGraph(t1);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.nodes).toHaveLength(1);
      expect(result.value.edges).toHaveLength(0);
      expect(result.value.nodes[0]!.name).toBe('Isolated');
    });

    it('deduplicates edges in diamond graph', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      const d = createTask('D');
      addDep(b, a);
      addDep(c, a);
      addDep(d, b);
      addDep(d, c);

      const result = container.dependencyService.buildGraph(a);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.nodes).toHaveLength(4);
      expect(result.value.edges).toHaveLength(4);
      // No duplicate edges
      const edgeKeys = result.value.edges.map((e) => `${e.from}->${e.to}`);
      expect(new Set(edgeKeys).size).toBe(edgeKeys.length);
    });

    it('includes multiple dependency types in graph', () => {
      const a = createTask('A');
      const b = createTask('B');
      const c = createTask('C');
      addDep(b, a, 'blocks');
      addDep(c, a, 'relates-to');

      const result = container.dependencyService.buildGraph(a);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.edges).toHaveLength(2);
      const types = result.value.edges.map((e) => e.type).sort();
      expect(types).toEqual(['blocks', 'relates-to']);
    });
  });

  // ─── Saved relation correctness ─────────────────────────────────────

  describe('saved relation correctness', () => {
    it('persists the correct direction: taskId depends on dependsOnId', () => {
      const blocker = createTask('Blocker');
      const dependent = createTask('Dependent');
      addDep(dependent, blocker);

      // The dependent should see the blocker
      const blockers = container.dependencyService.listBlockers(dependent);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value).toHaveLength(1);
      expect(blockers.value[0]!.id).toBe(blocker);

      // The blocker should see the dependent
      const dependents = container.dependencyService.listDependents(blocker);
      expect(dependents.ok).toBe(true);
      if (!dependents.ok) return;
      expect(dependents.value).toHaveLength(1);
      expect(dependents.value[0]!.id).toBe(dependent);
    });

    it('multiple dependency types between different pairs are stored independently', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      const t3 = createTask('Task 3');

      addDep(t1, t2, 'blocks');
      addDep(t1, t3, 'relates-to');

      const allDeps = container.dependencyService.listAllDeps(t1);
      expect(allDeps.ok).toBe(true);
      if (!allDeps.ok) return;
      expect(allDeps.value).toHaveLength(2);

      const blocksDep = allDeps.value.find((d) => d.type === 'blocks');
      const relDep = allDeps.value.find((d) => d.type === 'relates-to');
      expect(blocksDep?.dependsOnId).toBe(t2);
      expect(relDep?.dependsOnId).toBe(t3);
    });

    it('reverse direction is independent (A->B does not imply B->A)', () => {
      const a = createTask('A');
      const b = createTask('B');
      addDep(a, b); // A depends on B

      const aDeps = container.dependencyService.listAllDeps(a);
      expect(aDeps.ok).toBe(true);
      if (!aDeps.ok) return;
      expect(aDeps.value).toHaveLength(1);

      const bDeps = container.dependencyService.listAllDeps(b);
      expect(bDeps.ok).toBe(true);
      if (!bDeps.ok) return;
      expect(bDeps.value).toHaveLength(0);
    });
  });

  // ─── Edit dep-diff pattern (as used by handleFormSave) ─────────────

  describe('edit dependency diff (add/remove pattern)', () => {
    it('can swap a blocker for a different one (remove old, add new)', () => {
      // Regression: edit form previously never saved dep changes because
      // handleFormSave did not diff/apply the new dependsOn list.
      const task = createTask('Task');
      const oldBlocker = createTask('Old Blocker');
      const newBlocker = createTask('New Blocker');
      addDep(task, oldBlocker);

      // Simulate the edit save diff: remove old, add new
      container.dependencyService.removeDependency({ taskId: task, dependsOnId: oldBlocker });
      container.dependencyService.addDependency({
        taskId: task,
        dependsOnId: newBlocker,
        type: 'blocks',
      });

      const blockers = container.dependencyService.listBlockers(task);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value).toHaveLength(1);
      expect(blockers.value[0]!.id).toBe(newBlocker);
    });

    it('can clear all deps (remove all, add none)', () => {
      const task = createTask('Task');
      const b1 = createTask('B1');
      const b2 = createTask('B2');
      addDep(task, b1);
      addDep(task, b2);

      // Simulate saving with empty dependsOn
      const currentDeps = container.dependencyService.listAllDeps(task);
      if (!currentDeps.ok) throw new Error('setup failed');
      for (const dep of currentDeps.value) {
        container.dependencyService.removeDependency({
          taskId: task,
          dependsOnId: dep.dependsOnId,
        });
      }

      const result = container.dependencyService.listAllDeps(task);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toHaveLength(0);
    });

    it('can change dep type by removing and re-adding', () => {
      const task = createTask('Task');
      const other = createTask('Other');
      addDep(task, other, 'blocks');

      // Change type from blocks -> relates-to
      container.dependencyService.removeDependency({ taskId: task, dependsOnId: other });
      container.dependencyService.addDependency({
        taskId: task,
        dependsOnId: other,
        type: 'relates-to',
      });

      const allDeps = container.dependencyService.listAllDeps(task);
      expect(allDeps.ok).toBe(true);
      if (!allDeps.ok) return;
      expect(allDeps.value).toHaveLength(1);
      expect(allDeps.value[0]!.type).toBe('relates-to');
    });

    it('listAllDeps reflects the state after a sequence of add/remove (used to seed edit form)', () => {
      // Regression: edit form showed empty deps because listAllDeps was never consulted.
      const task = createTask('Task');
      const b1 = createTask('B1');
      const b2 = createTask('B2');
      addDep(task, b1, 'blocks');
      addDep(task, b2, 'relates-to');

      const deps = container.dependencyService.listAllDeps(task);
      expect(deps.ok).toBe(true);
      if (!deps.ok) return;
      expect(deps.value).toHaveLength(2);
      const types = deps.value.map((d) => d.type).sort();
      expect(types).toEqual(['blocks', 'relates-to']);
      const ids = deps.value.map((d) => d.dependsOnId).sort();
      expect(ids).toEqual([b1, b2].sort());
    });
  });

  // ─── Task deletion cascading ────────────────────────────────────────

  describe('cascade on task deletion', () => {
    it('deleting a task removes its dependencies via foreign key cascade', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1);

      // Delete t1 (the blocker)
      container.taskService.deleteTask(t1);

      const blockers = container.dependencyService.listBlockers(t2);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value).toHaveLength(0);
    });

    it('deleting the dependent task removes its outgoing dependencies', () => {
      const t1 = createTask('Task 1');
      const t2 = createTask('Task 2');
      addDep(t2, t1);

      // Delete t2 (the dependent)
      container.taskService.deleteTask(t2);

      const dependents = container.dependencyService.listDependents(t1);
      expect(dependents.ok).toBe(true);
      if (!dependents.ok) return;
      expect(dependents.value).toHaveLength(0);
    });
  });

  // ─── blocked-by normalization ────────────────────────────────────────

  describe('blocked-by normalization', () => {
    it('normalizes blocked-by: stores as blocks with swapped taskId/dependsOnId', () => {
      const a = createTask('A');
      const b = createTask('B');

      // "A is blocked-by B" → stored as "B blocks A"
      const result = container.dependencyService.addDependency({
        taskId: a,
        dependsOnId: b,
        type: 'blocked-by',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.taskId).toBe(b);
      expect(result.value.dependsOnId).toBe(a);
      expect(result.value.type).toBe('blocks');
    });

    it('blocked-by: A appears as a blocker of B after normalization', () => {
      const a = createTask('A');
      const b = createTask('B');

      // "A blocked-by B" in this CLI = "A blocks B" = B depends on A.
      // After normalization: {task_id: B, depends_on_id: A, type: blocks}.
      container.dependencyService.addDependency({ taskId: a, dependsOnId: b, type: 'blocked-by' });

      const blockers = container.dependencyService.listBlockers(b);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value.map((t) => t.id)).toContain(a);
    });
  });

  // ─── removeDependencyBetween ─────────────────────────────────────────

  describe('removeDependencyBetween', () => {
    it('removes a forward dependency (taskId → otherId)', () => {
      const t1 = createTask('T1');
      const t2 = createTask('T2');
      addDep(t2, t1); // t2 depends on t1

      const result = container.dependencyService.removeDependencyBetween(t2, t1);
      expect(result.ok).toBe(true);

      const blockers = container.dependencyService.listBlockers(t2);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value).toHaveLength(0);
    });

    it('removes a reverse dependency (otherId → taskId)', () => {
      const t1 = createTask('T1');
      const t2 = createTask('T2');
      addDep(t1, t2); // t1 depends on t2

      // Called with args in reverse order compared to storage direction
      const result = container.dependencyService.removeDependencyBetween(t2, t1);
      expect(result.ok).toBe(true);

      const blockers = container.dependencyService.listBlockers(t1);
      expect(blockers.ok).toBe(true);
      if (!blockers.ok) return;
      expect(blockers.value).toHaveLength(0);
    });

    it('returns error when no dependency exists between tasks', () => {
      const t1 = createTask('T1');
      const t2 = createTask('T2');

      const result = container.dependencyService.removeDependencyBetween(t1, t2);
      expect(result.ok).toBe(false);
    });
  });
});
