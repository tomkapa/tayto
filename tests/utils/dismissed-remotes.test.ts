import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GitRemote } from '../../src/types/git-remote.js';
import { isDismissedRemote, dismissRemote } from '../../src/utils/dismissed-remotes.js';

const filePath = join(tmpdir(), `tayto-test-dismissed-${process.pid}.json`);

beforeEach(() => {
  if (existsSync(filePath)) unlinkSync(filePath);
});

afterEach(() => {
  if (existsSync(filePath)) unlinkSync(filePath);
});

describe('isDismissedRemote', () => {
  it('returns false when file does not exist', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    expect(isDismissedRemote(filePath, remote)).toBe(false);
  });

  it('returns false when remote is not in the list', () => {
    writeFileSync(filePath, JSON.stringify(['github.com/other/repo']), 'utf-8');
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    expect(isDismissedRemote(filePath, remote)).toBe(false);
  });

  it('returns true when remote value is in the list', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    writeFileSync(filePath, JSON.stringify([remote.value]), 'utf-8');
    expect(isDismissedRemote(filePath, remote)).toBe(true);
  });

  it('returns false when file contains invalid JSON', () => {
    writeFileSync(filePath, 'not-json', 'utf-8');
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    expect(isDismissedRemote(filePath, remote)).toBe(false);
  });

  it('returns false when file contains non-array JSON', () => {
    writeFileSync(filePath, JSON.stringify({ value: 'github.com/org/repo' }), 'utf-8');
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    expect(isDismissedRemote(filePath, remote)).toBe(false);
  });
});

describe('dismissRemote', () => {
  it('creates the file with the remote when it does not exist', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    dismissRemote(filePath, remote);
    expect(isDismissedRemote(filePath, remote)).toBe(true);
  });

  it('appends to an existing list', () => {
    const remote1 = GitRemote.parse('git@github.com:org/repo1.git');
    const remote2 = GitRemote.parse('git@github.com:org/repo2.git');
    dismissRemote(filePath, remote1);
    dismissRemote(filePath, remote2);
    expect(isDismissedRemote(filePath, remote1)).toBe(true);
    expect(isDismissedRemote(filePath, remote2)).toBe(true);
  });

  it('is idempotent — does not add duplicates', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    dismissRemote(filePath, remote);
    dismissRemote(filePath, remote);
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    expect(content).toHaveLength(1);
  });

  it('recovers gracefully when file contains malformed JSON', () => {
    writeFileSync(filePath, 'corrupted', 'utf-8');
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    expect(() => dismissRemote(filePath, remote)).not.toThrow();
    expect(isDismissedRemote(filePath, remote)).toBe(true);
  });
});
