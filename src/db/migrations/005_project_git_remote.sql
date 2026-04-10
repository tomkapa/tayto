-- Add git_remote column to projects for linking projects to git repositories
ALTER TABLE projects ADD COLUMN git_remote TEXT DEFAULT NULL;

-- Partial unique index: enforces 1:1 project-to-remote mapping while allowing multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_git_remote ON projects(git_remote) WHERE git_remote IS NOT NULL;
