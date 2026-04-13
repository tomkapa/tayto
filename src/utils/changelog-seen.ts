import { readFileSync, writeFileSync } from 'node:fs';
import { logger } from '../logging/logger.js';

interface SeenCache {
  changelogSeenVersion: string;
}

function isValidSeenCache(value: unknown): value is SeenCache {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>)['changelogSeenVersion'] === 'string';
}

/**
 * Reads the last changelog version the user has seen from the cache file.
 * Returns null if the file is absent, malformed, or missing the field.
 */
export function readSeenVersion(cachePath: string): string | null {
  try {
    const raw = readFileSync(cachePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (isValidSeenCache(parsed)) return parsed.changelogSeenVersion;
    return null;
  } catch {
    logger.info('changelog-seen: cache not available', { path: cachePath });
    return null;
  }
}

/**
 * Writes the current app version as the last seen changelog version
 * to the cache file. Creates or overwrites the file.
 */
export function writeSeenVersion(cachePath: string, version: string): void {
  try {
    // Merge with existing content if present to preserve other fields
    let existing: Record<string, unknown> = {};
    try {
      const raw = readFileSync(cachePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      // File absent or malformed — start fresh
    }
    existing['changelogSeenVersion'] = version;
    writeFileSync(cachePath, JSON.stringify(existing), 'utf-8');
    logger.info('changelog-seen: persisted seen version', { version, path: cachePath });
  } catch {
    logger.warn('changelog-seen: failed to write seen version', { path: cachePath });
  }
}
