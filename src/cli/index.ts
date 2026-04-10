import { Command } from 'commander';
import type { Container } from './container.js';
import { registerProjectCreate } from './commands/project/create.js';
import { registerProjectList } from './commands/project/list.js';
import { registerProjectUpdate } from './commands/project/update.js';
import { registerProjectDelete } from './commands/project/delete.js';
import { registerProjectSetDefault } from './commands/project/set-default.js';
import { registerProjectLink } from './commands/project/link.js';
import { registerProjectUnlink } from './commands/project/unlink.js';
import { registerTaskCreate } from './commands/task/create.js';
import { registerTaskList } from './commands/task/list.js';
import { registerTaskShow } from './commands/task/show.js';
import { registerTaskUpdate } from './commands/task/update.js';
import { registerTaskDelete } from './commands/task/delete.js';
import { registerTaskBreakdown } from './commands/task/breakdown.js';
import { registerTaskRank } from './commands/task/rank.js';
import { registerTaskSearch } from './commands/task/search.js';
import { registerTaskExport } from './commands/task/export.js';
import { registerTaskImport } from './commands/task/import.js';
import { registerDepAdd } from './commands/dep/add.js';
import { registerDepRemove } from './commands/dep/remove.js';
import { registerDepList } from './commands/dep/list.js';
import { registerDepGraph } from './commands/dep/graph.js';

export function buildCLI(container: Container): Command {
  const program = new Command();
  program
    .name('tayto')
    .description('CLI task management for solo devs and AI agents')
    .version('0.1.0');

  const project = program.command('project').description('Manage projects');
  registerProjectCreate(project, container);
  registerProjectList(project, container);
  registerProjectUpdate(project, container);
  registerProjectDelete(project, container);
  registerProjectSetDefault(project, container);
  registerProjectLink(project, container);
  registerProjectUnlink(project, container);

  const task = program.command('task').description('Manage tasks');
  registerTaskCreate(task, container);
  registerTaskList(task, container);
  registerTaskShow(task, container);
  registerTaskUpdate(task, container);
  registerTaskDelete(task, container);
  registerTaskBreakdown(task, container);
  registerTaskRank(task, container);
  registerTaskSearch(task, container);
  registerTaskExport(task, container);
  registerTaskImport(task, container);

  const dep = program.command('dep').description('Manage task dependencies');
  registerDepAdd(dep, container);
  registerDepRemove(dep, container);
  registerDepList(dep, container);
  registerDepGraph(dep, container);

  program
    .command('tui')
    .description('Launch interactive terminal UI')
    .option('-p, --project <project>', 'Start with specific project')
    .action(async (opts: { project?: string }) => {
      const { launchTUI } = await import('../tui/index.js');
      await launchTUI(container, opts.project);
    });

  return program;
}
