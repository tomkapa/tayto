import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { trace } from '@opentelemetry/api';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import { AppError, toMessage } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { isNewerVersion } from '../utils/version.js';

export { isNewerVersion };

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@tomkapa/tayto/latest';
const PACKAGE_NAME = '@tomkapa/tayto';
const CHECK_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}

interface UpdateCache {
  checkedAt: number;
  latestVersion: string;
}

export interface UpdateService {
  checkForUpdate(currentVersion: string): Promise<Result<UpdateCheckResult>>;
  performUpgrade(currentVersion: string): Result<{ installedVersion: string }>;
}

/** Type guard for parsed cache JSON. */
function isValidCache(value: unknown): value is UpdateCache {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['checkedAt'] === 'number' && typeof obj['latestVersion'] === 'string';
}

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export type ExecFn = (cmd: string, args: string[]) => void;

function defaultExec(cmd: string, args: string[]): void {
  execFileSync(cmd, args, { stdio: 'inherit', timeout: 60000 });
}

const tracer = trace.getTracer('task');

export class UpdateServiceImpl implements UpdateService {
  constructor(
    private readonly cachePath: string,
    private readonly fetchImpl: FetchFn = globalThis.fetch,
    private readonly execImpl: ExecFn = defaultExec,
  ) {}

  async checkForUpdate(currentVersion: string): Promise<Result<UpdateCheckResult>> {
    return tracer.startActiveSpan('UpdateService.checkForUpdate', async (span) => {
      try {
        span.setAttribute('update.current_version', currentVersion);

        // Read cache
        const cached = this.readCache();
        if (cached && Date.now() - cached.checkedAt < CHECK_TTL_MS) {
          span.setAttribute('update.cache_hit', true);
          const updateAvailable = isNewerVersion(cached.latestVersion, currentVersion);
          span.setAttribute('update.latest_version', cached.latestVersion);
          span.setAttribute('update.available', updateAvailable);
          return ok({ currentVersion, latestVersion: cached.latestVersion, updateAvailable });
        }

        span.setAttribute('update.cache_hit', false);

        // Fetch from registry
        let latestVersion: string;
        const controller = new AbortController();
        const timeout = setTimeout(() => {
          controller.abort();
        }, 5000);
        try {
          const response = await this.fetchImpl(NPM_REGISTRY_URL, { signal: controller.signal });

          if (!response.ok) {
            logger.warn('Update check: registry returned non-OK status', {
              status: response.status,
            });
            return err(
              new AppError(
                'UPGRADE_CHECK',
                `npm registry returned status ${String(response.status)}`,
              ),
            );
          }

          const body = (await response.json()) as Record<string, unknown>;
          if (typeof body['version'] !== 'string') {
            return err(
              new AppError('UPGRADE_CHECK', 'Unexpected response format from npm registry'),
            );
          }
          latestVersion = body['version'];
        } catch (e: unknown) {
          logger.warn('Update check: fetch failed', { error: toMessage(e) });
          return err(
            new AppError('UPGRADE_CHECK', `Failed to check for updates: ${toMessage(e)}`, e),
          );
        } finally {
          clearTimeout(timeout);
        }

        // Write cache
        this.writeCache({ checkedAt: Date.now(), latestVersion });

        const updateAvailable = isNewerVersion(latestVersion, currentVersion);
        span.setAttribute('update.latest_version', latestVersion);
        span.setAttribute('update.available', updateAvailable);
        return ok({ currentVersion, latestVersion, updateAvailable });
      } finally {
        span.end();
      }
    });
  }

  performUpgrade(currentVersion: string): Result<{ installedVersion: string }> {
    return logger.startSpan('UpdateService.performUpgrade', (span) => {
      span.setAttribute('update.previous_version', currentVersion);
      try {
        this.execImpl('npm', ['install', '-g', `${PACKAGE_NAME}@latest`]);
      } catch (e: unknown) {
        logger.error('Upgrade failed', e, { command: `npm install -g ${PACKAGE_NAME}@latest` });
        span.setAttribute('update.success', false);
        return err(new AppError('UPGRADE_CHECK', `Upgrade failed: ${toMessage(e)}`, e));
      }

      // Read the newly installed version from the registry cache
      const cached = this.readCache();
      const installedVersion = cached?.latestVersion ?? 'unknown';
      span.setAttribute('update.success', true);
      span.setAttribute('update.installed_version', installedVersion);

      // Invalidate cache so next check fetches fresh
      this.writeCache({ checkedAt: 0, latestVersion: installedVersion });

      return ok({ installedVersion });
    });
  }

  private readCache(): UpdateCache | null {
    try {
      const raw = readFileSync(this.cachePath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      return isValidCache(parsed) ? parsed : null;
    } catch (e: unknown) {
      logger.info('Update cache not available', {
        error: toMessage(e),
      });
      return null;
    }
  }

  private writeCache(entry: UpdateCache): void {
    try {
      // Merge with existing content to preserve fields written by other utilities
      // (e.g. changelogSeenVersion written by changelog-seen.ts).
      let existing: Record<string, unknown> = {};
      try {
        const raw = readFileSync(this.cachePath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          existing = parsed as Record<string, unknown>;
        }
      } catch {
        // File absent or malformed — start fresh
      }
      writeFileSync(this.cachePath, JSON.stringify({ ...existing, ...entry }), 'utf-8');
    } catch (e: unknown) {
      logger.warn('Failed to write update cache', {
        error: toMessage(e),
      });
    }
  }
}
