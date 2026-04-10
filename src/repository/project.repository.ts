import type { DatabaseSync } from 'node:sqlite';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types/project.js';
import { AppError } from '../errors/app-error.js';
import { ulid } from 'ulid';
import { logger } from '../logging/logger.js';
import { NOT_DELETED } from './shared.js';

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string;
  is_default: number;
  task_counter: number;
  git_remote: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    gitRemote: row.git_remote,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProjectRepository {
  insert(input: CreateProjectInput & { key: string }): Result<Project>;
  findById(id: string): Result<Project | null>;
  findByKey(key: string): Result<Project | null>;
  findByName(name: string): Result<Project | null>;
  findByGitRemote(remote: string): Result<Project | null>;
  findDefault(): Result<Project | null>;
  findAll(): Result<Project[]>;
  update(id: string, input: UpdateProjectInput): Result<Project>;
  delete(id: string): Result<void>;
  incrementTaskCounter(id: string): Result<number>;
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: DatabaseSync) {}

  insert(input: CreateProjectInput & { key: string }): Result<Project> {
    return logger.startSpan('ProjectRepository.insert', () => {
      try {
        const now = new Date().toISOString();
        const id = ulid();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `INSERT INTO projects (id, key, name, description, is_default, git_remote, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.key,
            input.name,
            input.description ?? '',
            input.isDefault ? 1 : 0,
            input.gitRemote ?? null,
            now,
            now,
          );

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve inserted project'));
        }
        return ok(rowToProject(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          if (e.message.includes('git_remote')) {
            return err(
              new AppError(
                'DUPLICATE',
                `Git remote already linked to another project: ${input.gitRemote}`,
                e,
              ),
            );
          }
          return err(new AppError('DUPLICATE', `Project name already exists: ${input.name}`, e));
        }
        return err(new AppError('DB_ERROR', 'Failed to insert project', e));
      }
    });
  }

  findById(id: string): Result<Project | null> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
        .get(id) as ProjectRow | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by id', e));
    }
  }

  findByKey(key: string): Result<Project | null> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM projects WHERE key = ? AND ${NOT_DELETED}`)
        .get(key) as ProjectRow | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by key', e));
    }
  }

  findByName(name: string): Result<Project | null> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM projects WHERE name = ? AND ${NOT_DELETED}`)
        .get(name) as ProjectRow | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by name', e));
    }
  }

  findByGitRemote(remote: string): Result<Project | null> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM projects WHERE git_remote = ? AND ${NOT_DELETED}`)
        .get(remote) as ProjectRow | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by git remote', e));
    }
  }

  findDefault(): Result<Project | null> {
    try {
      const row = this.db
        .prepare(`SELECT * FROM projects WHERE is_default = 1 AND ${NOT_DELETED}`)
        .get() as ProjectRow | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find default project', e));
    }
  }

  findAll(): Result<Project[]> {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM projects WHERE ${NOT_DELETED} ORDER BY created_at DESC`)
        .all() as ProjectRow[];
      return ok(rows.map(rowToProject));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to list projects', e));
    }
  }

  update(id: string, input: UpdateProjectInput): Result<Project> {
    return logger.startSpan('ProjectRepository.update', () => {
      try {
        const existing = this.db
          .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as ProjectRow | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
        }

        const now = new Date().toISOString();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `UPDATE projects SET
               name = ?, description = ?, is_default = ?, git_remote = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : existing.is_default,
            input.gitRemote !== undefined ? input.gitRemote : existing.git_remote,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve updated project'));
        }
        return ok(rowToProject(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          if (e.message.includes('git_remote')) {
            return err(
              new AppError('DUPLICATE', `Git remote already linked to another project`, e),
            );
          }
          return err(new AppError('DUPLICATE', `Project name already exists`, e));
        }
        return err(new AppError('DB_ERROR', 'Failed to update project', e));
      }
    });
  }

  delete(id: string): Result<void> {
    return logger.startSpan('ProjectRepository.delete', () => {
      try {
        const existing = this.db
          .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as ProjectRow | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
        }
        const now = new Date().toISOString();
        this.db
          .prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, id);
        // Soft-delete all tasks in this project
        this.db
          .prepare(
            'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
          )
          .run(now, now, id);
        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to delete project', e));
      }
    });
  }

  incrementTaskCounter(id: string): Result<number> {
    return logger.startSpan('ProjectRepository.incrementTaskCounter', () => {
      try {
        this.db
          .prepare(
            `UPDATE projects SET task_counter = task_counter + 1 WHERE id = ? AND ${NOT_DELETED}`,
          )
          .run(id);
        const row = this.db
          .prepare(`SELECT task_counter FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as { task_counter: number } | undefined;
        if (!row) {
          return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
        }
        return ok(row.task_counter);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to increment task counter', e));
      }
    });
  }
}
