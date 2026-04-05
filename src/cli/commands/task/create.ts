import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskCreate(parent: Command, container: Container): void {
  parent
    .command('create')
    .description('Create a new task (appended to bottom of backlog)')
    .requiredOption('-n, --name <name>', 'Task name')
    .option('-p, --project <project>', 'Project id or name')
    .option('-d, --description <description>', 'Task description')
    .option('-t, --type <type>', 'Task type: epic, story, tech-debt, bug', 'story')
    .option('-s, --status <status>', 'Task status', 'backlog')
    .option('--parent <parentId>', 'Parent task id for subtask')
    .option('--technical-notes <notes>', 'Technical notes (markdown)')
    .option('--additional-requirements <requirements>', 'Additional requirements (markdown)')
    .option('--depends-on <ids...>', 'Task ids this task depends on (blocks relationship)')
    .action(
      (opts: {
        name: string;
        project?: string;
        description?: string;
        type?: string;
        status?: string;
        parent?: string;
        technicalNotes?: string;
        additionalRequirements?: string;
        dependsOn?: string[];
      }) => {
        const result = container.taskService.createTask(
          {
            name: opts.name,
            description: opts.description,
            type: opts.type,
            status: opts.status,
            parentId: opts.parent,
            technicalNotes: opts.technicalNotes,
            additionalRequirements: opts.additionalRequirements,
            dependsOn: opts.dependsOn?.map((id) => ({ id })),
          },
          opts.project,
        );
        handleResult(result);
      },
    );
}
