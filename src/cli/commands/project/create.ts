import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectCreate(parent: Command, container: Container): void {
  parent
    .command('create')
    .description('Create a new project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option(
      '-k, --key <key>',
      'Project key (2-7 uppercase alphanumeric chars, defaults to first 3 chars of name)',
    )
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as default project')
    .option('--git-remote <url>', 'Git remote URL to associate with the project')
    .action(
      (opts: {
        name: string;
        key?: string;
        description?: string;
        default?: boolean;
        gitRemote?: string;
      }) => {
        const result = container.projectService.createProject({
          name: opts.name,
          key: opts.key,
          description: opts.description,
          isDefault: opts.default,
          gitRemote: opts.gitRemote,
        });
        handleResult(result);
      },
    );
}
