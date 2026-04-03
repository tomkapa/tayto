import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { TaskDependency } from '../types/dependency.js';
import type { Task } from '../types/task.js';
import type { DependencyType } from '../types/enums.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { type TaskRow, rowToTask } from './shared.js';

interface DependencyRow {
  task_id: string;
  depends_on_id: string;
  type: string;
  created_at: string;
}

function rowToDependency(row: DependencyRow): TaskDependency {
  return {
    taskId: row.task_id,
    dependsOnId: row.depends_on_id,
    type: row.type as DependencyType,
    createdAt: row.created_at,
  };
}

export interface DependencyRepository {
  insert(taskId: string, dependsOnId: string, type: DependencyType): Result<TaskDependency>;
  delete(taskId: string, dependsOnId: string): Result<void>;
  findByTask(taskId: string): Result<TaskDependency[]>;
  findDependents(taskId: string): Result<TaskDependency[]>;
  /** Tasks that block taskId (taskId depends on them via 'blocks' type). */
  getBlockers(taskId: string): Result<Task[]>;
  /** Tasks that taskId blocks (they depend on taskId via 'blocks' type). */
  getDependents(taskId: string): Result<Task[]>;
  /** Tasks related to taskId via 'relates-to' in either direction. */
  getRelated(taskId: string): Result<Task[]>;
  /** Tasks connected to taskId via 'duplicates' in either direction. */
  getDuplicates(taskId: string): Result<Task[]>;
  /** Returns all transitive blockers using recursive CTE */
  getTransitiveClosure(taskId: string): Result<Task[]>;
  /** Checks if adding an edge would create a cycle */
  wouldCreateCycle(taskId: string, dependsOnId: string): Result<boolean>;
}

export class SqliteDependencyRepository implements DependencyRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(taskId: string, dependsOnId: string, type: DependencyType): Result<TaskDependency> {
    return logger.startSpan('DependencyRepository.insert', () => {
      try {
        const now = new Date().toISOString();
        this.db
          .prepare(
            `INSERT INTO task_dependencies (task_id, depends_on_id, type, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(taskId, dependsOnId, type, now);

        const row = this.db
          .prepare('SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .get(taskId, dependsOnId) as DependencyRow | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve inserted dependency'));
        }
        return ok(rowToDependency(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          return err(
            new AppError('DUPLICATE', `Dependency already exists: ${taskId} -> ${dependsOnId}`, e),
          );
        }
        if (e instanceof Error && e.message.includes('FOREIGN KEY constraint')) {
          return err(new AppError('NOT_FOUND', 'One or both tasks do not exist', e));
        }
        if (e instanceof Error && e.message.includes('CHECK constraint')) {
          return err(new AppError('VALIDATION', 'A task cannot depend on itself', e));
        }
        return err(new AppError('DB_ERROR', 'Failed to insert dependency', e));
      }
    });
  }

  delete(taskId: string, dependsOnId: string): Result<void> {
    return logger.startSpan('DependencyRepository.delete', () => {
      try {
        const existing = this.db
          .prepare('SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .get(taskId, dependsOnId) as DependencyRow | undefined;
        if (!existing) {
          return err(
            new AppError('NOT_FOUND', `Dependency not found: ${taskId} -> ${dependsOnId}`),
          );
        }
        this.db
          .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .run(taskId, dependsOnId);
        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to delete dependency', e));
      }
    });
  }

  findByTask(taskId: string): Result<TaskDependency[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at ASC')
        .all(taskId) as DependencyRow[];
      return ok(rows.map(rowToDependency));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find dependencies for task', e));
    }
  }

  findDependents(taskId: string): Result<TaskDependency[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM task_dependencies WHERE depends_on_id = ? ORDER BY created_at ASC')
        .all(taskId) as DependencyRow[];
      return ok(rows.map(rowToDependency));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find dependents for task', e));
    }
  }

  getBlockers(taskId: string): Result<Task[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT t.* FROM tasks t
           JOIN task_dependencies td ON t.id = td.depends_on_id
           WHERE td.task_id = ? AND td.type = 'blocks' AND t.deleted_at IS NULL
           ORDER BY t.rank ASC`,
        )
        .all(taskId) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get blockers', e));
    }
  }

  getDependents(taskId: string): Result<Task[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT t.* FROM tasks t
           JOIN task_dependencies td ON t.id = td.task_id
           WHERE td.depends_on_id = ? AND td.type = 'blocks' AND t.deleted_at IS NULL
           ORDER BY t.rank ASC`,
        )
        .all(taskId) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get dependents', e));
    }
  }

  getRelated(taskId: string): Result<Task[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT DISTINCT t.* FROM tasks t
           JOIN task_dependencies td ON (
             (td.task_id = ? AND td.depends_on_id = t.id) OR
             (td.depends_on_id = ? AND td.task_id = t.id)
           )
           WHERE td.type = 'relates-to' AND t.deleted_at IS NULL
           ORDER BY t.rank ASC`,
        )
        .all(taskId, taskId) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get related tasks', e));
    }
  }

  getDuplicates(taskId: string): Result<Task[]> {
    try {
      const rows = this.db
        .prepare(
          `SELECT DISTINCT t.* FROM tasks t
           JOIN task_dependencies td ON (
             (td.task_id = ? AND td.depends_on_id = t.id) OR
             (td.depends_on_id = ? AND td.task_id = t.id)
           )
           WHERE td.type = 'duplicates' AND t.deleted_at IS NULL
           ORDER BY t.rank ASC`,
        )
        .all(taskId, taskId) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get duplicate tasks', e));
    }
  }

  getTransitiveClosure(taskId: string): Result<Task[]> {
    try {
      const rows = this.db
        .prepare(
          `WITH RECURSIVE transitive_deps(id) AS (
             SELECT depends_on_id FROM task_dependencies WHERE task_id = ?
             UNION
             SELECT td.depends_on_id FROM task_dependencies td
             JOIN transitive_deps d ON td.task_id = d.id
           )
           SELECT t.* FROM tasks t
           WHERE t.id IN (SELECT id FROM transitive_deps) AND t.deleted_at IS NULL
           ORDER BY t.rank ASC`,
        )
        .all(taskId) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get transitive closure', e));
    }
  }

  wouldCreateCycle(taskId: string, dependsOnId: string): Result<boolean> {
    try {
      // Check: can we reach taskId starting from dependsOnId by following depends_on edges?
      // If yes, adding dependsOnId -> taskId would create a cycle.
      const row = this.db
        .prepare(
          `WITH RECURSIVE reachable(id) AS (
             SELECT depends_on_id FROM task_dependencies WHERE task_id = ?
             UNION
             SELECT td.depends_on_id FROM task_dependencies td
             JOIN reachable r ON td.task_id = r.id
           )
           SELECT 1 AS found FROM reachable WHERE id = ? LIMIT 1`,
        )
        .get(dependsOnId, taskId) as { found: number } | undefined;
      return ok(row !== undefined);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to check for cycle', e));
    }
  }
}
