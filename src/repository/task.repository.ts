import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../types/task.js';
import type { TaskLevel } from '../types/enums.js';
import { RANK_GAP, TERMINAL_STATUSES, getTaskLevel, midpoint, WORK_TYPES } from '../types/enums.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { NOT_DELETED, type TaskRow, rowToTask } from './shared.js';
import { parseSearchQuery } from '../utils/search-parser.js';

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
  /** Level-aware max rank (scoped to types matching the given level). */
  getMaxRankByLevel(projectId: string, level: TaskLevel): Result<number>;
  /** Level-aware max active rank. */
  getMaxActiveRankByLevel(projectId: string, level: TaskLevel): Result<number>;
  /** Level-aware min terminal rank. */
  getMinTerminalRankByLevel(projectId: string, level: TaskLevel): Result<number | null>;
  /** Ranked tasks filtered to the same level. */
  getRankedTasksByLevel(projectId: string, level: TaskLevel, status?: string): Result<Task[]>;
  /** Ranked non-terminal tasks filtered to the same level. */
  getRankedNonTerminalTasksByLevel(projectId: string, level: TaskLevel): Result<Task[]>;
  /**
   * Redistribute ranks at the given level so that every active task sits
   * strictly below every terminal task, separated by clean `RANK_GAP`
   * intervals. Recovers from floating-point precision collapse after many
   * midpoint insertions and repairs any pre-existing interleaved state.
   */
  rebalanceByLevel(projectId: string, level: TaskLevel): Result<void>;
  /** FTS5 ranked search across all text fields */
  search(query: string, projectId?: string): Result<SearchResult[]>;
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(id: string, input: CreateTaskInput & { projectId: string }): Result<Task> {
    return logger.startSpan('TaskRepository.insert', () => {
      try {
        const now = new Date().toISOString();
        const level = getTaskLevel(input.type);

        // New tasks go after the last active task but before terminal (done/cancelled) tasks
        // within the same level (epics rank among epics, work items among work items).
        const rankResult = this.computeInsertRank(input.projectId, level);
        if (!rankResult.ok) return rankResult;
        const rank = rankResult.value;

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
      const params: string[] = [];

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
      if (filter.level !== undefined) {
        const typesForLevel = this.getTypesForLevel(filter.level as TaskLevel);
        const placeholders = typesForLevel.map(() => '?').join(', ');
        conditions.push(`type IN (${placeholders})`);
        params.push(...typesForLevel);
      }
      if (filter.parentId) {
        conditions.push('parent_id = ?');
        params.push(filter.parentId);
      }
      if (filter.parentIds && filter.parentIds.length > 0) {
        const placeholders = filter.parentIds.map(() => '?').join(', ');
        conditions.push(`parent_id IN (${placeholders})`);
        params.push(...filter.parentIds);
      }
      if (filter.search) {
        const parsed = parseSearchQuery(filter.search);
        if (parsed.kind === 'id') {
          conditions.push(`id LIKE ?`);
          params.push(`%${parsed.value}%`);
        } else {
          // Use FTS5 for tokenized, ranked search with prefix matching
          const ftsQuery = parsed.query
            .split(/\s+/)
            .map((term) => `"${term.replace(/"/g, '""')}"*`)
            .join(' ');
          conditions.push(`id IN (SELECT id FROM tasks_fts WHERE tasks_fts MATCH ?)`);
          params.push(ftsQuery);
        }
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
      let params: string[];
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

  private getTypesForLevel(level: TaskLevel): string[] {
    if (level === 1) return ['epic'];
    return [...WORK_TYPES];
  }

  getMaxRankByLevel(projectId: string, level: TaskLevel): Result<number> {
    try {
      const types = this.getTypesForLevel(level);
      const placeholders = types.map(() => '?').join(', ');
      const row = this.db
        .prepare(
          `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${placeholders})`,
        )
        .get(projectId, ...types) as { max_rank: number | null } | undefined;
      return ok(row?.max_rank ?? 0);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get max rank by level', e));
    }
  }

  getMaxActiveRankByLevel(projectId: string, level: TaskLevel): Result<number> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      const row = this.db
        .prepare(
          `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status NOT IN (${TERMINAL_PLACEHOLDERS})`,
        )
        .get(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as
        | { max_rank: number | null }
        | undefined;
      return ok(row?.max_rank ?? 0);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get max active rank by level', e));
    }
  }

  getMinTerminalRankByLevel(projectId: string, level: TaskLevel): Result<number | null> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      const row = this.db
        .prepare(
          `SELECT MIN(rank) as min_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status IN (${TERMINAL_PLACEHOLDERS})`,
        )
        .get(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as
        | { min_rank: number | null }
        | undefined;
      return ok(row?.min_rank ?? null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get min terminal rank by level', e));
    }
  }

  getRankedTasksByLevel(projectId: string, level: TaskLevel, status?: string): Result<Task[]> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      let sql: string;
      let params: string[];
      if (status) {
        sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status = ? ORDER BY rank ASC`;
        params = [projectId, ...types, status];
      } else {
        sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) ORDER BY rank ASC`;
        params = [projectId, ...types];
      }
      const rows = this.db.prepare(sql).all(...params) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get ranked tasks by level', e));
    }
  }

  getRankedNonTerminalTasksByLevel(projectId: string, level: TaskLevel): Result<Task[]> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      const sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status NOT IN (${TERMINAL_PLACEHOLDERS}) ORDER BY rank ASC`;
      const rows = this.db
        .prepare(sql)
        .all(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get ranked non-terminal tasks by level', e));
    }
  }

  rebalanceByLevel(projectId: string, level: TaskLevel): Result<void> {
    return logger.startSpan('TaskRepository.rebalanceByLevel', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        // Active tasks first (current rank order), then terminal tasks —
        // this both recovers from precision collapse and repairs any
        // pre-existing interleaved state. Precondition: caller is not
        // already inside a transaction.
        const rows = this.db
          .prepare(
            `SELECT * FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders})
             ORDER BY
               CASE WHEN status IN (${TERMINAL_PLACEHOLDERS}) THEN 1 ELSE 0 END ASC,
               rank ASC,
               id ASC`,
          )
          .all(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as TaskRow[];

        if (rows.length === 0) return ok(undefined);

        const now = new Date().toISOString();
        const updateStmt = this.db.prepare(
          'UPDATE tasks SET rank = ?, updated_at = ? WHERE id = ?',
        );

        this.db.exec('BEGIN');
        try {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const newRank = (i + 1) * RANK_GAP;
            if (row.rank === newRank) continue;
            updateStmt.run(newRank, now, row.id);
          }
          this.db.exec('COMMIT');
        } catch (inner) {
          this.db.exec('ROLLBACK');
          throw inner;
        }

        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to rebalance ranks by level', e));
      }
    });
  }

  /**
   * Fetch `(maxActive, minTerminal)` for a level in a single SQL round-trip.
   * Used by the insert hot path — faster than calling the two separate
   * level accessors in sequence.
   */
  private getRankBoundsByLevel(
    projectId: string,
    level: TaskLevel,
  ): Result<{ maxActive: number; minTerminal: number | null }> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      const row = this.db
        .prepare(
          `SELECT
             MAX(CASE WHEN status NOT IN (${TERMINAL_PLACEHOLDERS}) THEN rank END) AS max_active,
             MIN(CASE WHEN status IN (${TERMINAL_PLACEHOLDERS}) THEN rank END) AS min_terminal
           FROM tasks
           WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders})`,
        )
        .get(...TERMINAL_STATUS_ARRAY, ...TERMINAL_STATUS_ARRAY, projectId, ...types) as
        | { max_active: number | null; min_terminal: number | null }
        | undefined;
      return ok({
        maxActive: row?.max_active ?? 0,
        minTerminal: row?.min_terminal ?? null,
      });
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to get rank bounds by level', e));
    }
  }

  /**
   * Compute a fresh rank for a new active task at the given level.
   *
   * Wedges the new task between the last active task and the first terminal
   * task. If the midpoint collapses against either endpoint, or if the
   * level is already in a corrupt interleaved state (terminal rank ≤
   * active rank), rebalance the level once and recompute.
   */
  private computeInsertRank(projectId: string, level: TaskLevel): Result<number> {
    const attempt = (): Result<number | null> => {
      const boundsResult = this.getRankBoundsByLevel(projectId, level);
      if (!boundsResult.ok) return boundsResult;
      const { maxActive, minTerminal } = boundsResult.value;

      if (minTerminal === null) {
        return ok(maxActive + RANK_GAP);
      }
      if (minTerminal <= maxActive) {
        return ok(null);
      }
      // Anchor against the terminal when there are no prior active tasks
      // (or the first active task happens to sit at rank 0).
      if (maxActive <= 0) {
        return ok(minTerminal - RANK_GAP);
      }
      return ok(midpoint(maxActive, minTerminal));
    };

    const first = attempt();
    if (!first.ok) return first;
    if (first.value !== null) return ok(first.value);

    const rebalanceResult = this.rebalanceByLevel(projectId, level);
    if (!rebalanceResult.ok) return rebalanceResult;

    const second = attempt();
    if (!second.ok) return second;
    if (second.value === null) {
      return err(new AppError('DB_ERROR', 'Rank computation did not converge after rebalance'));
    }
    return ok(second.value);
  }

  search(query: string, projectId?: string): Result<SearchResult[]> {
    return logger.startSpan('TaskRepository.search', () => {
      try {
        const parsed = parseSearchQuery(query);

        if (parsed.kind === 'id') {
          const conditions = ['t.id LIKE ?', 't.deleted_at IS NULL'];
          const params: string[] = [`%${parsed.value}%`];
          if (projectId) {
            conditions.push('t.project_id = ?');
            params.push(projectId);
          }
          const sql = `SELECT t.*, 0 AS fts_rank FROM tasks t WHERE ${conditions.join(' AND ')} ORDER BY t.rank ASC`;
          const rows = this.db.prepare(sql).all(...params) as (TaskRow & { fts_rank: number })[];
          return ok(rows.map((row) => ({ task: rowToTask(row), rank: row.fts_rank })));
        }

        const ftsQuery = parsed.query
          .split(/\s+/)
          .map((term) => `"${term.replace(/"/g, '""')}"*`)
          .join(' ');

        let sql: string;
        let params: string[];

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
