import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  dbPath: string;
  logDir: string;
  logLevel: string;
  otelEndpoint: string | undefined;
  updateCachePath: string;
  dismissedGitRemotesPath: string;
  telemetryStatePath: string;
  noUpdateCheck: boolean;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function loadConfig(): Config {
  const dataDir = process.env['TASK_DATA_DIR'] ?? join(homedir(), '.task');
  ensureDir(dataDir);

  const logDir = process.env['TASK_LOG_DIR'] ?? join(dataDir, 'logs');
  ensureDir(logDir);

  return {
    dbPath: process.env['TASK_DB_PATH'] ?? join(dataDir, 'data.db'),
    logDir,
    logLevel: process.env['TASK_LOG_LEVEL'] ?? 'info',
    otelEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
    updateCachePath: join(dataDir, 'update-check.json'),
    dismissedGitRemotesPath: join(dataDir, 'dismissed-git-remotes.json'),
    telemetryStatePath: join(dataDir, 'telemetry.json'),
    noUpdateCheck: process.env['TAYTO_NO_UPDATE_CHECK'] === '1',
  };
}
