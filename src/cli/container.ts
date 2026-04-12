import type { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteProjectRepository } from '../repository/project.repository.js';
import { SqliteTaskRepository } from '../repository/task.repository.js';
import { SqliteDependencyRepository } from '../repository/dependency.repository.js';
import { ProjectServiceImpl } from '../service/project.service.js';
import type { DetectGitRemoteFn } from '../service/project.service.js';
import { TaskServiceImpl } from '../service/task.service.js';
import { DependencyServiceImpl } from '../service/dependency.service.js';
import { PortabilityServiceImpl } from '../service/portability.service.js';
import { UpdateServiceImpl } from '../service/update.service.js';
import type { ProjectService } from '../service/project.service.js';
import type { TaskService } from '../service/task.service.js';
import type { DependencyService } from '../service/dependency.service.js';
import type { PortabilityService } from '../service/portability.service.js';
import type { UpdateService } from '../service/update.service.js';

export interface Container {
  dbPath: string;
  dismissedGitRemotesPath: string;
  projectService: ProjectService;
  taskService: TaskService;
  dependencyService: DependencyService;
  portabilityService: PortabilityService;
  updateService: UpdateService;
}

export function createContainer(
  db: DatabaseSync,
  dbPath: string,
  detectGitRemote?: DetectGitRemoteFn,
  updateCachePath?: string,
  dismissedGitRemotesPath?: string,
): Container {
  const projectRepo = new SqliteProjectRepository(db);
  const taskRepo = new SqliteTaskRepository(db);
  const depRepo = new SqliteDependencyRepository(db);
  const projectService = new ProjectServiceImpl(projectRepo, detectGitRemote);
  const dependencyService = new DependencyServiceImpl(depRepo, taskRepo);
  const taskService = new TaskServiceImpl(taskRepo, projectService, () => dependencyService);
  const portabilityService = new PortabilityServiceImpl(taskService, dependencyService);
  const updateService = new UpdateServiceImpl(
    updateCachePath ?? join(tmpdir(), 'tayto-update-check.json'),
  );

  return {
    dbPath,
    dismissedGitRemotesPath: dismissedGitRemotesPath ?? join(tmpdir(), 'tayto-dismissed-git-remotes.json'),
    projectService,
    taskService,
    dependencyService,
    portabilityService,
    updateService,
  };
}
