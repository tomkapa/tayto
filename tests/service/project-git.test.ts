import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/db/migrator.js';
import { SqliteProjectRepository } from '../../src/repository/project.repository.js';
import { ProjectServiceImpl } from '../../src/service/project.service.js';
import type { ProjectService, DetectGitRemoteFn } from '../../src/service/project.service.js';
import { ok } from '../../src/types/common.js';

function createTestService(detectRemote?: DetectGitRemoteFn): ProjectService {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  const repo = new SqliteProjectRepository(db);
  return new ProjectServiceImpl(repo, detectRemote);
}

describe('ProjectService git remote', () => {
  let service: ProjectService;

  beforeEach(() => {
    service = createTestService();
  });

  describe('linkGitRemote', () => {
    it('links a project to a git remote by explicit URL', () => {
      service.createProject({ name: 'MyProject', isDefault: true });
      const result = service.linkGitRemote('MyProject', 'git@github.com:org/repo.git');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBe('git@github.com:org/repo.git');
    });

    it('links a project using auto-detection', () => {
      const mockDetect: DetectGitRemoteFn = () => ok('https://github.com/org/auto.git');
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'AutoProject', isDefault: true });

      const result = svc.linkGitRemote('AutoProject');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBe('https://github.com/org/auto.git');
    });

    it('returns NOT_FOUND when auto-detect finds no remote', () => {
      const mockDetect: DetectGitRemoteFn = () => ok(null);
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'NoGit', isDefault: true });

      const result = svc.linkGitRemote('NoGit');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toContain('No git remote detected');
    });

    it('returns DUPLICATE when remote is already linked to another project', () => {
      service.createProject({ name: 'Alpha', key: 'ALP' });
      service.createProject({ name: 'Beta', key: 'BET' });
      service.linkGitRemote('Alpha', 'git@github.com:org/repo.git');

      const result = service.linkGitRemote('Beta', 'git@github.com:org/repo.git');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DUPLICATE');
      expect(result.error.message).toContain('already linked');
    });

    it('allows re-linking the same project to the same remote', () => {
      service.createProject({ name: 'ReLink', isDefault: true });
      service.linkGitRemote('ReLink', 'git@github.com:org/repo.git');

      // Re-linking same remote to same project should succeed
      const result = service.linkGitRemote('ReLink', 'git@github.com:org/repo.git');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBe('git@github.com:org/repo.git');
    });

    it('allows updating a project remote to a different URL', () => {
      service.createProject({ name: 'Update', isDefault: true });
      service.linkGitRemote('Update', 'git@github.com:org/old.git');

      const result = service.linkGitRemote('Update', 'git@github.com:org/new.git');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBe('git@github.com:org/new.git');
    });

    it('returns NOT_FOUND for a non-existent project', () => {
      const result = service.linkGitRemote('ghost', 'git@github.com:org/repo.git');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('unlinkGitRemote', () => {
    it('clears the git remote from a project', () => {
      service.createProject({ name: 'Linked', isDefault: true });
      service.linkGitRemote('Linked', 'git@github.com:org/repo.git');

      const result = service.unlinkGitRemote('Linked');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBeNull();
    });

    it('returns NOT_FOUND when project has no linked remote', () => {
      service.createProject({ name: 'NoLink', isDefault: true });
      const result = service.unlinkGitRemote('NoLink');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toContain('no linked git remote');
    });

    it('returns NOT_FOUND for a non-existent project', () => {
      const result = service.unlinkGitRemote('ghost');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('resolveProjectWithGit', () => {
    it('resolves by explicit name (ignores git detection)', () => {
      const mockDetect: DetectGitRemoteFn = () => ok('https://github.com/org/other.git');
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'Explicit', isDefault: true });
      svc.createProject({ name: 'GitMatch' });
      svc.linkGitRemote('GitMatch', 'https://github.com/org/other.git');

      const result = svc.resolveProjectWithGit('Explicit');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('Explicit');
    });

    it('resolves by git remote when no explicit name given', () => {
      const mockDetect: DetectGitRemoteFn = () => ok('git@github.com:org/repo.git');
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'Default', isDefault: true });
      svc.createProject({ name: 'GitProject' });
      svc.linkGitRemote('GitProject', 'git@github.com:org/repo.git');

      const result = svc.resolveProjectWithGit();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('GitProject');
    });

    it('falls back to default when git remote has no match', () => {
      const mockDetect: DetectGitRemoteFn = () => ok('git@github.com:org/unlinked.git');
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'DefaultFallback', isDefault: true });

      const result = svc.resolveProjectWithGit();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('DefaultFallback');
    });

    it('falls back to default when git detection returns null', () => {
      const mockDetect: DetectGitRemoteFn = () => ok(null);
      const svc = createTestService(mockDetect);
      svc.createProject({ name: 'DefaultNoGit', isDefault: true });

      const result = svc.resolveProjectWithGit();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.name).toBe('DefaultNoGit');
    });
  });

  describe('createProject with gitRemote', () => {
    it('creates a project with a git remote', () => {
      const result = service.createProject({
        name: 'WithRemote',
        gitRemote: 'git@github.com:org/new.git',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBe('git@github.com:org/new.git');
    });

    it('creates a project without a git remote', () => {
      const result = service.createProject({ name: 'NoRemote' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.gitRemote).toBeNull();
    });

    it('rejects creating a project with a duplicate git remote', () => {
      service.createProject({
        name: 'First',
        gitRemote: 'git@github.com:org/dup.git',
      });
      const result = service.createProject({
        name: 'Second',
        gitRemote: 'git@github.com:org/dup.git',
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('DUPLICATE');
    });
  });
});
