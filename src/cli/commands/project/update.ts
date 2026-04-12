import { Command } from 'commander';
import type { Container } from '../../container.js';
import type { UpdateProjectInput } from '../../types/project.js';
import { handleResult } from '../../output.js';

export function registerProjectUpdate(parent: Command, container: Container): void {
  parent
    .command('update <idOrKeyOrName>')
    .description('Update a project (lookup by id, key, or name)')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as default project')
    .option('--git-remote <url>', 'Git remote URL (use --no-git-remote to unlink)')
    .option('--no-git-remote', 'Unlink git remote')
    .action(
      (
        idOrKeyOrName: string,
        opts: {
          name?: string;
          description?: string;
          default?: boolean;
          gitRemote?: string | false;
        },
      ) => {
        const resolved = container.projectService.resolveProject(idOrKeyOrName);
        if (!resolved.ok) {
          handleResult(resolved);
          return;
        }
        const updateInput: UpdateProjectInput = {
          name: opts.name,
          description: opts.description,
          isDefault: opts.default,
          ...(opts.gitRemote === false
            ? { gitRemote: null }
            : typeof opts.gitRemote === 'string'
              ? { gitRemote: opts.gitRemote }
              : {}),
        };
        const result = container.projectService.updateProject(resolved.value.id, updateInput);
        handleResult(result);
      },
    );
}
