import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readSeenVersion, writeSeenVersion } from '../../src/utils/changelog-seen.js';

let tmpDir: string;
let cachePath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'tayto-test-'));
  cachePath = join(tmpDir, 'cache.json');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('readSeenVersion', () => {
  it('returns null when file does not exist', () => {
    expect(readSeenVersion(cachePath)).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    writeFileSync(cachePath, 'not-json', 'utf-8');
    expect(readSeenVersion(cachePath)).toBeNull();
  });

  it('returns null when field is missing', () => {
    writeFileSync(cachePath, JSON.stringify({ other: 'field' }), 'utf-8');
    expect(readSeenVersion(cachePath)).toBeNull();
  });

  it('returns the version when field is present', () => {
    writeFileSync(cachePath, JSON.stringify({ changelogSeenVersion: '0.7.0' }), 'utf-8');
    expect(readSeenVersion(cachePath)).toBe('0.7.0');
  });
});

describe('writeSeenVersion', () => {
  it('creates the file with the version when it does not exist', () => {
    writeSeenVersion(cachePath, '0.7.0');
    const content: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
    expect(content).toMatchObject({ changelogSeenVersion: '0.7.0' });
  });

  it('updates the version while preserving other fields', () => {
    writeFileSync(cachePath, JSON.stringify({ checkedAt: 12345, latestVersion: '0.8.0' }), 'utf-8');
    writeSeenVersion(cachePath, '0.7.0');
    const content: unknown = JSON.parse(readFileSync(cachePath, 'utf-8'));
    expect(content).toMatchObject({
      checkedAt: 12345,
      latestVersion: '0.8.0',
      changelogSeenVersion: '0.7.0',
    });
  });

  it('overwrites an existing version', () => {
    writeFileSync(cachePath, JSON.stringify({ changelogSeenVersion: '0.5.0' }), 'utf-8');
    writeSeenVersion(cachePath, '0.7.0');
    expect(readSeenVersion(cachePath)).toBe('0.7.0');
  });
});
