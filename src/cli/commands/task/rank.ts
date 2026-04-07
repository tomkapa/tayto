import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskRank(parent: Command, container: Container): void {
  parent
    .command('rank <id>')
    .description('Re-rank a task in the backlog (Jira-style positioning)')
    .option('--after <taskId>', 'Place immediately after this task')
    .option('--before <taskId>', 'Place immediately before this task')
    .option('--position <n>', 'Place at 1-based position in backlog')
    .option('--top', 'Move to the top of active tasks')
    .option('--bottom', 'Move to the bottom of active tasks (above done tasks)')
    .option('-p, --project <project>', 'Project id or name')
    .action(
      (
        id: string,
        opts: {
          after?: string;
          before?: string;
          position?: string;
          top?: boolean;
          bottom?: boolean;
          project?: string;
        },
      ) => {
        const result = container.taskService.rerankTask(
          {
            taskId: id,
            afterId: opts.after,
            beforeId: opts.before,
            position: opts.position ? parseInt(opts.position, 10) : undefined,
            top: opts.top,
            bottom: opts.bottom,
          },
          opts.project,
        );
        handleResult(result);
      },
    );
}
