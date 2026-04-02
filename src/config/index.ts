import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Config {
  dbPath: string;
  logLevel: string;
  otelEndpoint: string | undefined;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function loadConfig(): Config {
  const dataDir = process.env['TASK_DATA_DIR'] ?? join(homedir(), '.task');
  ensureDir(dataDir);

  return {
    dbPath: process.env['TASK_DB_PATH'] ?? join(dataDir, 'data.db'),
    logLevel: process.env['TASK_LOG_LEVEL'] ?? 'info',
    otelEndpoint: process.env['OTEL_EXPORTER_OTLP_ENDPOINT'],
  };
}
