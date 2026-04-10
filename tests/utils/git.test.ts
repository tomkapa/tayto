import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as childProcess from 'node:child_process';
import { detectGitRemote } from '../../src/utils/git.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

const spawnSyncMock = vi.mocked(childProcess.spawnSync);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('detectGitRemote', () => {
  it('returns the trimmed remote URL on success', () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: '  git@github.com:org/repo.git\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = detectGitRemote('/some/dir');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('git@github.com:org/repo.git');
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'git',
      ['remote', 'get-url', 'origin'],
      expect.objectContaining({ cwd: '/some/dir' }),
    );
  });

  it('returns ok(null) when git exits with non-zero status', () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'fatal: not a git repository',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = detectGitRemote();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('returns ok(null) when spawnSync has an error', () => {
    spawnSyncMock.mockReturnValue({
      status: null,
      stdout: '',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
      error: new Error('ENOENT'),
    });

    const result = detectGitRemote();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('returns ok(null) when stdout is empty/whitespace', () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: '  \n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    const result = detectGitRemote();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('returns ok(null) when spawnSync throws', () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('spawn failed');
    });

    const result = detectGitRemote();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  it('uses process.cwd() when no cwd is provided', () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: 'https://github.com/org/repo.git\n',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });

    detectGitRemote();
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'git',
      ['remote', 'get-url', 'origin'],
      expect.objectContaining({ cwd: process.cwd() }),
    );
  });
});
