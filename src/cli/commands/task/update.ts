import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskUpdate(parent: Command, container: Container): void {
  parent
    .command('update <id>')
    .description('Update a task')
    .option('-n, --name <name>', 'Task name')
    .option('-d, --description <description>', 'Task description')
    .option('-t, --type <type>', 'Task type: epic, story, tech-debt, bug')
    .option('-s, --status <status>', 'Task status')
    .option('--parent <parentId>', 'Parent task id')
    .option('--technical-notes <notes>', 'Replace technical notes')
    .option('--additional-requirements <requirements>', 'Replace additional requirements')
    .option('--append-notes <notes>', 'Append to technical notes')
    .option('--append-requirements <requirements>', 'Append to additional requirements')
    .action(
      (
        id: string,
        opts: {
          name?: string;
          description?: string;
          type?: string;
          status?: string;
          parent?: string;
          technicalNotes?: string;
          additionalRequirements?: string;
          appendNotes?: string;
          appendRequirements?: string;
        },
      ) => {
        const result = container.taskService.updateTask(id, {
          name: opts.name,
          description: opts.description,
          type: opts.type,
          status: opts.status,
          parentId: opts.parent,
          technicalNotes: opts.technicalNotes,
          additionalRequirements: opts.additionalRequirements,
          appendNotes: opts.appendNotes,
          appendRequirements: opts.appendRequirements,
        });
        handleResult(result);
      },
    );
}
