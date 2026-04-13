import { readFileSync, writeFileSync } from 'node:fs';
import type { GitRemote } from '../types/git-remote.js';
import { logger } from '../logging/logger.js';

/**
 * Returns true if the given remote has been dismissed by the user and should
 * not trigger the "new project detected" dialog again.
 */
export function isDismissedRemote(filePath: string, remote: GitRemote): boolean {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const list: unknown = JSON.parse(content);
    if (!Array.isArray(list)) return false;
    return list.includes(remote.value);
  } catch {
    return false;
  }
}

/**
 * Persists a remote as dismissed so it won't prompt again in future sessions.
 */
export function dismissRemote(filePath: string, remote: GitRemote): void {
  let list: string[] = [];
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(content);
    if (Array.isArray(parsed)) {
      list = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // File absent or malformed — start fresh
  }
  if (list.includes(remote.value)) return;
  list.push(remote.value);
  try {
    writeFileSync(filePath, JSON.stringify(list), 'utf-8');
    logger.info(`dismissRemote: persisted ${remote.value} to ${filePath}`);
  } catch (e: unknown) {
    logger.error(
      `dismissRemote: failed to write ${filePath}`,
      e instanceof Error ? e : new Error(String(e)),
    );
  }
}
