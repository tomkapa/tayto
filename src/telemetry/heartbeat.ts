import { readFile, writeFile } from 'node:fs/promises';
import { logger } from '../logging/logger.js';
import { toMessage } from '../errors/app-error.js';
import { InstallId } from '../types/install-id.js';
import { isCI } from '../utils/ci.js';
import type { FetchFn } from '../types/common.js';

const HEARTBEAT_URL = 'https://tayto-telemetry.tomkapa.workers.dev/api/heartbeat';
const TIMEOUT_MS = 3000;

interface TelemetryState {
  installId: InstallId;
  lastPingDate: string;
}

function isValidRawState(value: unknown): value is { installId: string; lastPingDate: string } {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['installId'] === 'string' && typeof obj['lastPingDate'] === 'string';
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function readState(statePath: string): Promise<TelemetryState | null> {
  let raw: string;
  try {
    raw = await readFile(statePath, 'utf-8');
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('telemetry: failed to read state', { error: toMessage(e), path: statePath });
    }
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidRawState(parsed)) return null;
    return { installId: InstallId.parse(parsed.installId), lastPingDate: parsed.lastPingDate };
  } catch (e: unknown) {
    logger.warn('telemetry: corrupt state file, will regenerate', {
      error: toMessage(e),
      path: statePath,
    });
    return null;
  }
}

async function writeState(
  statePath: string,
  state: { installId: string; lastPingDate: string },
): Promise<void> {
  try {
    await writeFile(statePath, JSON.stringify(state), 'utf-8');
  } catch (e: unknown) {
    logger.warn('telemetry: failed to write state', { error: toMessage(e), path: statePath });
  }
}

export interface HeartbeatDeps {
  statePath: string;
  version: string;
  fetchImpl?: FetchFn;
  env?: Record<string, string | undefined>;
}

/**
 * Sends at most one anonymous heartbeat ping per calendar day (UTC).
 * Fire-and-forget: never blocks, never throws.
 */
export function maybeSendHeartbeat(deps: HeartbeatDeps): void {
  const { statePath, version, fetchImpl = globalThis.fetch, env = process.env } = deps;

  void (async () => {
    try {
      if (env['TASKCLI_TELEMETRY_DISABLED'] === '1') {
        logger.info('telemetry: disabled via TASKCLI_TELEMETRY_DISABLED');
        return;
      }

      if (isCI(env)) {
        logger.info('telemetry: skipped in CI environment');
        return;
      }

      const today = todayUTC();
      const state = await readState(statePath);

      if (state && state.lastPingDate === today) {
        return;
      }

      const installId = state ? state.installId : InstallId.generate();

      // Write today's date before sending so at most one attempt per day even if the endpoint is down
      await writeState(statePath, { installId: installId.toString(), lastPingDate: today });

      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, TIMEOUT_MS);
      timeout.unref();

      const payload = {
        installId: installId.toString(),
        version,
        os: process.platform,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };

      fetchImpl(HEARTBEAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
        .then(() => {
          clearTimeout(timeout);
          logger.info('telemetry: heartbeat sent', { installId: installId.toString() });
        })
        .catch((e: unknown) => {
          clearTimeout(timeout);
          logger.info('telemetry: heartbeat failed (non-blocking)', { error: toMessage(e) });
        });
    } catch (e: unknown) {
      logger.warn('telemetry: unexpected error in maybeSendHeartbeat', { error: toMessage(e) });
    }
  })();
}
