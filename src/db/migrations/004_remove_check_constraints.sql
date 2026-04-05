-- Remove CHECK constraints on type and status columns to allow future custom types.
-- SQLite does not support ALTER CONSTRAINT, so we recreate the table.

-- Step 1: Recreate tasks table without CHECK constraints on type/status
CREATE TABLE tasks_new (
  id                      TEXT PRIMARY KEY,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id               TEXT REFERENCES tasks_new(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  type                    TEXT NOT NULL,
  status                  TEXT NOT NULL,
  rank                    REAL NOT NULL DEFAULT 0,
  technical_notes         TEXT NOT NULL DEFAULT '',
  additional_requirements TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL,
  deleted_at              TEXT DEFAULT NULL
);

-- Step 2: Copy data
INSERT INTO tasks_new SELECT * FROM tasks;

-- Step 3: Drop old FTS triggers (they reference the old table)
DROP TRIGGER IF EXISTS tasks_fts_ai;
DROP TRIGGER IF EXISTS tasks_fts_ad;
DROP TRIGGER IF EXISTS tasks_fts_au;

-- Step 4: Drop old table and rename
DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- Step 5: Recreate indexes
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_tasks_rank ON tasks(rank);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

-- Step 6: Rebuild FTS index
INSERT INTO tasks_fts(tasks_fts) VALUES('rebuild');

-- Step 7: Recreate FTS triggers (soft-delete aware, from migration 003)
CREATE TRIGGER tasks_fts_ai AFTER INSERT ON tasks
WHEN NEW.deleted_at IS NULL
BEGIN
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements);
END;

CREATE TRIGGER tasks_fts_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
END;

CREATE TRIGGER tasks_fts_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  SELECT NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements
  WHERE NEW.deleted_at IS NULL;
END;
