import { loadConfig } from './config/index.js';
import { createDatabase } from './db/connection.js';
import { runMigrations } from './db/migrator.js';
import { initTelemetry, shutdownTelemetry } from './logging/telemetry.js';
import { logger } from './logging/logger.js';
import { createContainer } from './cli/container.js';
import { buildCLI } from './cli/index.js';
import { AppError } from './errors/app-error.js';

async function main(): Promise<void> {
  const config = loadConfig();
  logger.init(config.logDir);
  initTelemetry(config);

  const db = createDatabase(config.dbPath);
  runMigrations(db);

  const container = createContainer(db, config.dbPath);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    // Default: launch TUI when no subcommand (git-aware project resolution happens in App.tsx)
    const { launchTUI } = await import('./tui/index.js');
    await launchTUI(container);
  } else {
    const program = buildCLI(container);
    await program.parseAsync(process.argv);
  }

  db.close();
  await shutdownTelemetry();
}

main().catch((e: unknown) => {
  const error =
    e instanceof AppError
      ? e
      : new AppError('UNKNOWN', e instanceof Error ? e.message : 'Unknown error', e);

  process.stderr.write(
    JSON.stringify({ ok: false, error: { code: error.code, message: error.message } }, null, 2) +
      '\n',
  );
  process.exit(1);
});
