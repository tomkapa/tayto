import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatabaseSync } from 'node:sqlite';
import { logger } from '../logging/logger.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

function loadMigrations(): Array<{ name: string; sql: string }> {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((name) => ({
    name,
    sql: readFileSync(join(migrationsDir, name), 'utf-8'),
  }));
}

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  );

  const migrations = loadMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    logger.info(`Applying migration: ${migration.name}`);

    db.exec('BEGIN');
    try {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString(),
      );
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    logger.info(`Migration applied: ${migration.name}`);
  }
}
