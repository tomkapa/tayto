import type { DatabaseSync } from 'node:sqlite';
import { SqliteProjectRepository } from '../repository/project.repository.js';
import { SqliteTaskRepository } from '../repository/task.repository.js';
import { SqliteDependencyRepository } from '../repository/dependency.repository.js';
import { ProjectServiceImpl } from '../service/project.service.js';
import { TaskServiceImpl } from '../service/task.service.js';
import { DependencyServiceImpl } from '../service/dependency.service.js';
import { PortabilityServiceImpl } from '../service/portability.service.js';
import type { ProjectService } from '../service/project.service.js';
import type { TaskService } from '../service/task.service.js';
import type { DependencyService } from '../service/dependency.service.js';
import type { PortabilityService } from '../service/portability.service.js';

export interface Container {
  projectService: ProjectService;
  taskService: TaskService;
  dependencyService: DependencyService;
  portabilityService: PortabilityService;
}

export function createContainer(db: DatabaseSync): Container {
  const projectRepo = new SqliteProjectRepository(db);
  const taskRepo = new SqliteTaskRepository(db);
  const depRepo = new SqliteDependencyRepository(db);
  const projectService = new ProjectServiceImpl(projectRepo);
  const dependencyService = new DependencyServiceImpl(depRepo, taskRepo);
  const taskService = new TaskServiceImpl(taskRepo, projectService, () => dependencyService);
  const portabilityService = new PortabilityServiceImpl(
    taskService,
    dependencyService,
    projectService,
  );

  return { projectService, taskService, dependencyService, portabilityService };
}
