import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectLink(parent: Command, container: Container): void {
  parent
    .command('link <idOrKeyOrName>')
    .description('Link a project to a git remote (auto-detects from cwd if --remote omitted)')
    .option('-r, --remote <url>', 'Git remote URL')
    .action((idOrKeyOrName: string, opts: { remote?: string }) => {
      const result = container.projectService.linkGitRemote(idOrKeyOrName, opts.remote);
      handleResult(result);
    });
}
