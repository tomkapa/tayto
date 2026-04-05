import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskList(parent: Command, container: Container): void {
  parent
    .command('list')
    .description('List tasks in rank order (defaults to level 2 backlog tasks)')
    .option('-p, --project <project>', 'Filter by project id or name')
    .option('-s, --status <status>', 'Filter by status (default: backlog)')
    .option('-t, --type <type>', 'Filter by type (epic, story, tech-debt, bug)')
    .option('-l, --level <level>', 'Filter by level (1=epic, 2=work). Default: 2')
    .option('--parent <parentId>', 'Filter by parent task id')
    .option('--search <text>', 'Search in name, description, and notes')
    .action(
      (opts: {
        project?: string;
        status?: string;
        type?: string;
        level?: string;
        parent?: string;
        search?: string;
      }) => {
        const result = container.taskService.listTasks({
          projectId: opts.project,
          status: opts.status ?? 'backlog',
          type: opts.type,
          level: opts.level ? parseInt(opts.level, 10) : undefined,
          parentId: opts.parent,
          search: opts.search,
        });
        handleResult(result);
      },
    );
}
