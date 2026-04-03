import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../types/task.js';
import { RANK_GAP, TERMINAL_STATUSES } from '../types/enums.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { NOT_DELETED, type TaskRow, rowToTask } from './shared.js';

const TERMINAL_STATUS_ARRAY = [...TERMINAL_STATUSES];
const TERMINAL_PLACEHOLDERS = TERMINAL_STATUS_ARRAY.map(() => '?').join(', ');

export interface SearchResult {
  task: Task;
  rank: number;
}

export interface TaskRepository {
  insert(id: string, input: CreateTaskInput & { projectId: string }): Result<Task>;
  findById(id: string): Result<Task | null>;
  findMany(filter: TaskFilter): Result<Task[]>;
  update(id: string, input: UpdateTaskInput): Result<Task>;
  delete(id: string): Result<void>;
  rerank(taskId: string, newRank: number): Result<Task>;
  getMaxRank(projectId: string): Result<number>;
  /** Max rank among non-terminal (not done/cancelled) tasks. Returns 0 if none. */
  getMaxActiveRank(projectId: string): Result<number>;
  /** Min rank among terminal (done/cancelled) tasks. Returns null if none. */
  getMinTerminalRank(projectId: string): Result<number | null>;
  getRankedTasks(projectId: string, status?: string): Result<Task[]>;
  /** FTS5 ranked search across all text fields */
  search(query: string, projectId?: string): Result<SearchResult[]>;
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(id: string, input: CreateTaskInput & { projectId: string }): Result<Task> {
    return logger.startSpan('TaskRepository.insert', () => {
      try {
        const now = new Date().toISOString();

        // New tasks go after the last active task but before terminal (done/cancelled) tasks
        const maxActiveResult = this.getMaxActiveRank(input.projectId);
        if (!maxActiveResult.ok) return maxActiveResult;
        const maxActiveRank = maxActiveResult.value;

        const minTerminalResult = this.getMinTerminalRank(input.projectId);
        if (!minTerminalResult.ok) return minTerminalResult;
        const minTerminalRank = minTerminalResult.value;

        let rank: number;
        if (minTerminalRank !== null && minTerminalRank > maxActiveRank) {
          rank =
            maxActiveRank > 0 ? (maxActiveRank + minTerminalRank) / 2 : minTerminalRank - RANK_GAP;
        } else {
          rank = maxActiveRank + RANK_GAP;
        }

        this.db
          .prepare(
            `INSERT INTO tasks (id, project_id, parent_id, name, description, type, status, rank, technical_notes, additional_requirements, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.projectId,
            input.parentId ?? null,
            input.name,
            input.description ?? '',
            input.type,
            input.status,
            rank,
            input.technicalNotes ?? '',
            input.additionalRequirements ?? '',
            now,
            now,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve inserted task'));
        }
        return ok(rowToTask(row));
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to insert task', e));
      }
    });
  }

  findById(id: string): Result<Task | null> {
    try {
      const row = this.db.prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`).get(id) as
        | TaskRow
        | undefined;
      return ok(row ? rowToTask(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find task by id', e));
    }
  }

  findMany(filter: TaskFilter): Result<Task[]> {
    try {
      const conditions: string[] = [NOT_DELETED];
      const params: unknown[] = [];

      if (filter.projectId) {
        conditions.push('project_id = ?');
        params.push(filter.projectId);
      }
      if (filter.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }
      if (filter.type) {
        conditions.push('type = ?');
        params.push(filter.type);
      }
      if (filter.parentId) {
        conditions.push('parent_id = ?');
        params.push(filter.parentId);
      }
      if (filter.search) {
        // Use FTS5 for tokenized, ranked search with prefix matching
        const ftsQuery = filter.search
          .trim()
          .split(/\s+/)
          .map((term) => `"${term.replace(/"/g, '""')}"*`)
          .join(' ');
        conditions.push(`id IN (SELECT id FROM tasks_fts WHERE tasks_fts MATCH ?)`);
        params.push(ftsQuery);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM tasks ${where} ORDER BY rank ASC`;

      const rows = this.db.prepare(sql).all(...params) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to list tasks', e));
    }
  }

  update(id: string, input: UpdateTaskInput): Result<Task> {
    return logger.startSpan('TaskRepository.update', () => {
      try {
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as TaskRow | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
        }

        const now = new Date().toISOString();

        let technicalNotes = input.technicalNotes ?? existing.technical_notes;
        if (input.appendNotes) {
          technicalNotes =
            existing.technical_notes +
            (existing.technical_notes ? `\n\n---\n_${now}_\n\n` : '') +
            input.appendNotes;
        }

        let additionalRequirements =
          input.additionalRequirements ?? existing.additional_requirements;
        if (input.appendRequirements) {
          additionalRequirements =
            existing.additional_requirements +
            (existing.additional_requirements ? `\n\n---\n_${now}_\n\n` : '') +
            input.appendRequirements;
        }

        this.db
          .prepare(
            `UPDATE tasks SET
               name = ?, description = ?, type = ?, status = ?,
               parent_id = ?, technical_notes = ?, additional_requirements = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.type ?? existing.type,
            input.status ?? existing.status,
            input.parentId !== undefined ? input.parentId : existing.parent_id,
            technicalNotes,
            additionalRequirements,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve updated task'));
        }
        return ok(rowToTask(row));
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to update task', e));
      }
    });
  }

  delete(id: string): Result<void> {
    return logger.startSpan('TaskRepository.delete', () => {
      try {
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as TaskRow | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
        }
        const now = new Date().toISOString();
        this.db
          .prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, id);
        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to delete task', e));
      }
    });
  }

  rerank(taskId: string, newRank: number): Result<Task> {
    return logger.startSpan('TaskRepository.rerank', () => {
      try {
        const now = new Date().toISOString();
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(taskId) as TaskRow | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Task not found: ${taskId}`));
        }
        this.db
          .prepare('UPDATE tasks SET rank = ?, updated_at = ? WHERE id = ?')
          .run(newRank, now, taskId);

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
          | TaskRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve reranked task'));
        }
        return ok(rowToTask(row));
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to rerank task', e));
      }
    });
  }

  getMaxRank(projectId: string): Result<number> {
    try {
      const row = this.db
        .prepare(`SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED}`)
        .get(projectId) as { max_rank: number | null } | undefined;
      return ok(row?.max_rank ?? 0);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get max rank', e));
    }
  }

  getMaxActiveRank(projectId: string): Result<number> {
    try {
      const row = this.db
        .prepare(
          `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status NOT IN (${TERMINAL_PLACEHOLDERS})`,
        )
        .get(projectId, ...TERMINAL_STATUS_ARRAY) as { max_rank: number | null } | undefined;
      return ok(row?.max_rank ?? 0);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get max active rank', e));
    }
  }

  getMinTerminalRank(projectId: string): Result<number | null> {
    try {
      const row = this.db
        .prepare(
          `SELECT MIN(rank) as min_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status IN (${TERMINAL_PLACEHOLDERS})`,
        )
        .get(projectId, ...TERMINAL_STATUS_ARRAY) as { min_rank: number | null } | undefined;
      return ok(row?.min_rank ?? null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get min terminal rank', e));
    }
  }

  getRankedTasks(projectId: string, status?: string): Result<Task[]> {
    try {
      let sql: string;
      let params: unknown[];
      if (status) {
        sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status = ? ORDER BY rank ASC`;
        params = [projectId, status];
      } else {
        sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} ORDER BY rank ASC`;
        params = [projectId];
      }
      const rows = this.db.prepare(sql).all(...params) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get ranked tasks', e));
    }
  }

  search(query: string, projectId?: string): Result<SearchResult[]> {
    return logger.startSpan('TaskRepository.search', () => {
      try {
        const ftsQuery = query
          .trim()
          .split(/\s+/)
          .map((term) => `"${term.replace(/"/g, '""')}"*`)
          .join(' ');

        let sql: string;
        let params: unknown[];

        if (projectId) {
          sql = `SELECT t.*, bm25(tasks_fts) AS fts_rank
                 FROM tasks_fts f
                 JOIN tasks t ON t.id = f.id AND t.deleted_at IS NULL
                 WHERE tasks_fts MATCH ? AND t.project_id = ?
                 ORDER BY fts_rank ASC`;
          params = [ftsQuery, projectId];
        } else {
          sql = `SELECT t.*, bm25(tasks_fts) AS fts_rank
                 FROM tasks_fts f
                 JOIN tasks t ON t.id = f.id AND t.deleted_at IS NULL
                 WHERE tasks_fts MATCH ?
                 ORDER BY fts_rank ASC`;
          params = [ftsQuery];
        }

        const rows = this.db.prepare(sql).all(...params) as (TaskRow & { fts_rank: number })[];
        return ok(
          rows.map((row) => ({
            task: rowToTask(row),
            rank: row.fts_rank,
          })),
        );
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Full-text search failed', e));
      }
    });
  }
}
