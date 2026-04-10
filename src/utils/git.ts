import { spawnSync } from 'node:child_process';
import type { Result } from '../types/common.js';
import { ok } from '../types/common.js';
import { logger } from '../logging/logger.js';

/**
 * Detect the git origin remote URL from the given directory.
 * Returns ok(url) if found, ok(null) if no git repo or no origin remote.
 * Never returns err() — all git failures are silent fallbacks.
 */
export function detectGitRemote(cwd?: string): Result<string | null> {
  try {
    const result = spawnSync('git', ['remote', 'get-url', 'origin'], {
      cwd: cwd ?? process.cwd(),
      encoding: 'utf-8',
      timeout: 5000,
    });

    if (result.status !== 0 || result.error) {
      logger.info('detectGitRemote: no git remote found (non-zero exit or error)');
      return ok(null);
    }

    const remote = result.stdout.trim();
    if (!remote) {
      logger.info('detectGitRemote: empty stdout from git remote get-url');
      return ok(null);
    }

    logger.info(`detectGitRemote: found remote=${remote}`);
    return ok(remote);
  } catch (e: unknown) {
    logger.info(`detectGitRemote: exception during git detection: ${String(e)}`);
    return ok(null);
  }
}
