import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, TaskFilter } from '../types/task.js';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFilterSchema,
  RerankTaskSchema,
} from '../types/task.js';
import type { TaskRepository, SearchResult } from '../repository/task.repository.js';
import type { ProjectService } from './project.service.js';
import type { DependencyService } from './dependency.service.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import {
  TaskStatus,
  TaskLevel,
  RANK_GAP,
  isTerminalStatus,
  getTaskLevel,
  midpoint,
} from '../types/enums.js';

export interface TaskService {
  createTask(input: unknown, projectIdOrName?: string): Result<Task>;
  getTask(id: string): Result<Task>;
  listTasks(filter: unknown): Result<Task[]>;
  updateTask(id: string, input: unknown): Result<Task>;
  deleteTask(id: string): Result<void>;
  breakdownTask(parentId: string, subtasks: unknown[]): Result<Task[]>;
  rerankTask(input: unknown, projectIdOrName?: string): Result<Task>;
  searchTasks(query: string, projectIdOrName?: string): Result<SearchResult[]>;
}

export class TaskServiceImpl implements TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly projectService: ProjectService,
    private readonly getDependencyService: () => DependencyService,
  ) {}

  createTask(input: unknown, projectIdOrName?: string): Result<Task> {
    return logger.startSpan('TaskService.createTask', () => {
      const parsed = CreateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const projectRef = parsed.data.projectId ?? projectIdOrName;
      const projectResult = this.projectService.resolveProject(projectRef);
      if (!projectResult.ok) return projectResult;

      const taskLevel = getTaskLevel(parsed.data.type);

      // Epics (level 1) cannot have a parent
      if (taskLevel === TaskLevel.Epic && parsed.data.parentId) {
        return err(new AppError('VALIDATION', 'Epic tasks cannot have a parent'));
      }

      if (parsed.data.parentId) {
        const parentResult = this.repo.findById(parsed.data.parentId);
        if (!parentResult.ok) return parentResult;
        if (!parentResult.value) {
          return err(new AppError('NOT_FOUND', `Parent task not found: ${parsed.data.parentId}`));
        }
        // Level 2 tasks can only be children of level 1 (epic) tasks
        if (getTaskLevel(parentResult.value.type) !== TaskLevel.Epic) {
          return err(new AppError('VALIDATION', 'Tasks can only be children of epic-level tasks'));
        }
      }

      const project = projectResult.value;
      const taskIdResult = this.projectService.nextTaskId(project);
      if (!taskIdResult.ok) return taskIdResult;

      const insertResult = this.repo.insert(taskIdResult.value, {
        ...parsed.data,
        projectId: project.id,
      });
      if (!insertResult.ok) return insertResult;

      if (parsed.data.dependsOn && parsed.data.dependsOn.length > 0) {
        for (const entry of parsed.data.dependsOn) {
          const depResult = this.getDependencyService().addDependency({
            taskId: insertResult.value.id,
            dependsOnId: entry.id,
            type: entry.type,
          });
          if (!depResult.ok) return depResult;
        }
      }

      return insertResult;
    });
  }

  getTask(id: string): Result<Task> {
    return logger.startSpan('TaskService.getTask', () => {
      const result = this.repo.findById(id);
      if (!result.ok) return result;
      if (!result.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
      }
      return ok(result.value);
    });
  }

  listTasks(filter: unknown): Result<Task[]> {
    return logger.startSpan('TaskService.listTasks', () => {
      const parsed = TaskFilterSchema.safeParse(filter);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      let resolvedFilter: TaskFilter = parsed.data;

      if (parsed.data.projectId) {
        const projectResult = this.projectService.resolveProject(parsed.data.projectId);
        if (!projectResult.ok) return projectResult;
        resolvedFilter = { ...resolvedFilter, projectId: projectResult.value.id };
      }

      return this.repo.findMany(resolvedFilter);
    });
  }

  updateTask(id: string, input: unknown): Result<Task> {
    return logger.startSpan('TaskService.updateTask', () => {
      const parsed = UpdateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      // Enforce: cannot start a task that still has unfinished blockers.
      if (parsed.data.status === TaskStatus.InProgress) {
        const blockersResult = this.getDependencyService().listBlockers(id);
        if (!blockersResult.ok) return blockersResult;
        const hasNonTerminalBlocker = blockersResult.value.some((b) => !isTerminalStatus(b.status));
        if (hasNonTerminalBlocker) {
          return err(new AppError('VALIDATION', 'Task is blocked by unfinished dependencies'));
        }
      }

      // Fetch existing task for level/status transition checks
      const existingResult = this.repo.findById(id);
      if (!existingResult.ok) return existingResult;
      if (!existingResult.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
      }
      const existing = existingResult.value;

      // Validate type change against level constraints
      if (parsed.data.type) {
        const newLevel = getTaskLevel(parsed.data.type);
        const oldLevel = getTaskLevel(existing.type);

        if (newLevel !== oldLevel) {
          // Changing from epic to work: reject if it has children
          if (oldLevel === TaskLevel.Epic) {
            const childrenResult = this.repo.findMany({
              projectId: existing.projectId,
              parentId: id,
            });
            if (childrenResult.ok && childrenResult.value.length > 0) {
              return err(
                new AppError(
                  'VALIDATION',
                  'Cannot change type from epic: task has children. Remove children first.',
                ),
              );
            }
          }
          // Changing to epic: reject if it has a parent
          if (newLevel === TaskLevel.Epic && existing.parentId) {
            return err(new AppError('VALIDATION', 'Cannot change type to epic: task has a parent'));
          }
        }
      }

      // Validate parentId change against level constraints
      if (parsed.data.parentId !== undefined) {
        const effectiveType = parsed.data.type ?? existing.type;
        const effectiveLevel = getTaskLevel(effectiveType);

        if (effectiveLevel === TaskLevel.Epic && parsed.data.parentId) {
          return err(new AppError('VALIDATION', 'Epic tasks cannot have a parent'));
        }
        if (parsed.data.parentId) {
          const parentResult = this.repo.findById(parsed.data.parentId);
          if (!parentResult.ok) return parentResult;
          if (!parentResult.value) {
            return err(new AppError('NOT_FOUND', `Parent task not found: ${parsed.data.parentId}`));
          }
          if (getTaskLevel(parentResult.value.type) !== TaskLevel.Epic) {
            return err(
              new AppError('VALIDATION', 'Tasks can only be children of epic-level tasks'),
            );
          }
        }
      }

      // Check if transitioning to terminal status (done/cancelled)
      if (parsed.data.status && isTerminalStatus(parsed.data.status)) {
        const effectiveType = parsed.data.type ?? existing.type;
        const level = getTaskLevel(effectiveType);

        const updateResult = this.repo.update(id, parsed.data);
        if (!updateResult.ok) return updateResult;

        // Auto-rerank to bottom only when transitioning from active → terminal
        if (!isTerminalStatus(existing.status)) {
          const maxRankResult = this.repo.getMaxRankByLevel(existing.projectId, level);
          if (!maxRankResult.ok) return maxRankResult;
          const rerankResult = this.repo.rerank(id, maxRankResult.value + RANK_GAP);
          if (!rerankResult.ok) return rerankResult;
          this.propagateParentStatus(existing);
          return rerankResult;
        }
        this.propagateParentStatus(existing);
        return updateResult;
      }

      const updateResult = this.repo.update(id, parsed.data);
      if (!updateResult.ok) return updateResult;

      // Propagate status to parent when transitioning to in-progress
      if (parsed.data.status && parsed.data.status !== existing.status) {
        this.propagateParentStatus(existing);
      }

      return updateResult;
    });
  }

  deleteTask(id: string): Result<void> {
    return this.repo.delete(id);
  }

  breakdownTask(parentId: string, subtasks: unknown[]): Result<Task[]> {
    return logger.startSpan('TaskService.breakdownTask', () => {
      const parentResult = this.repo.findById(parentId);
      if (!parentResult.ok) return parentResult;
      if (!parentResult.value) {
        return err(new AppError('NOT_FOUND', `Parent task not found: ${parentId}`));
      }

      const parent = parentResult.value;

      // Parent must be an epic (level 1) to have children
      if (getTaskLevel(parent.type) !== TaskLevel.Epic) {
        return err(new AppError('VALIDATION', 'Breakdown parent must be an epic-level task'));
      }

      const projectResult = this.projectService.resolveProject(parent.projectId);
      if (!projectResult.ok) return projectResult;
      const project = projectResult.value;

      const created: Task[] = [];

      for (const subtask of subtasks) {
        const parsed = CreateTaskSchema.safeParse(subtask);
        if (!parsed.success) {
          return err(new AppError('VALIDATION', `Invalid subtask: ${parsed.error.message}`));
        }

        // Subtasks must be level 2 (work items)
        if (getTaskLevel(parsed.data.type) === TaskLevel.Epic) {
          return err(new AppError('VALIDATION', `Subtask "${parsed.data.name}" cannot be an epic`));
        }

        const taskIdResult = this.projectService.nextTaskId(project);
        if (!taskIdResult.ok) return taskIdResult;

        const result = this.repo.insert(taskIdResult.value, {
          ...parsed.data,
          projectId: parent.projectId,
          parentId,
        });
        if (!result.ok) return result;
        created.push(result.value);
      }

      return ok(created);
    });
  }

  /**
   * Re-rank a task using Jira-style ranking:
   * - afterId: place the task immediately after the given task
   * - beforeId: place the task immediately before the given task
   * - position: place the task at the given 1-based position in the backlog
   *
   * New rank is computed as the midpoint between neighbors.
   * If moving to the top, rank = first_rank - GAP.
   * If moving to the bottom, rank = last_rank + GAP.
   */
  rerankTask(input: unknown, projectIdOrName?: string): Result<Task> {
    return logger.startSpan('TaskService.rerankTask', () => {
      const parsed = RerankTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const { taskId, afterId, beforeId, position, top, bottom } = parsed.data;

      const specifiedCount =
        [afterId, beforeId, position].filter((v) => v !== undefined).length +
        (top ? 1 : 0) +
        (bottom ? 1 : 0);
      if (specifiedCount !== 1) {
        return err(
          new AppError(
            'VALIDATION',
            'Exactly one of --after, --before, --position, --top, or --bottom must be specified',
          ),
        );
      }

      const taskResult = this.repo.findById(taskId);
      if (!taskResult.ok) return taskResult;
      if (!taskResult.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${taskId}`));
      }
      const task = taskResult.value;

      if (isTerminalStatus(task.status)) {
        return err(
          new AppError(
            'VALIDATION',
            `Cannot rerank a task with status '${task.status}'. Only active tasks can be reranked.`,
          ),
        );
      }

      const taskLevel = getTaskLevel(task.type);

      // Resolve project for getting ranked list
      const projectRef = projectIdOrName ?? task.projectId;
      const projectResult = this.projectService.resolveProject(projectRef);
      if (!projectResult.ok) return projectResult;
      const projectId = projectResult.value.id;

      // Filtering excludes terminal and cross-project tasks — neither
      // participates in this rank space, so they cannot constrain it.
      const depService = this.getDependencyService();
      const blockersResult = depService.listBlockers(taskId);
      if (!blockersResult.ok) return blockersResult;
      const constrainingBlockers = blockersResult.value.filter(
        (b) => !isTerminalStatus(b.status) && b.projectId === projectId,
      );
      const dependentsResult = depService.listDependents(taskId);
      if (!dependentsResult.ok) return dependentsResult;
      const constrainingDependents = dependentsResult.value.filter(
        (d) => !isTerminalStatus(d.status) && d.projectId === projectId,
      );

      // Returns `ok(null)` to signal FP precision collapse — the caller
      // rebalances once and retries on a fresh snapshot.
      const attempt = (): Result<number | null> => {
        const rankedResult = this.repo.getRankedNonTerminalTasksByLevel(projectId, taskLevel);
        if (!rankedResult.ok) return rankedResult;
        const ranked = rankedResult.value.filter((t) => t.id !== taskId);

        if (top === true) {
          return ok(this.computeTopRank(ranked, constrainingBlockers));
        }
        if (bottom === true) {
          const minTerminalResult = this.repo.getMinTerminalRankByLevel(projectId, taskLevel);
          if (!minTerminalResult.ok) return minTerminalResult;
          return ok(
            this.computeBottomRank(ranked, minTerminalResult.value, constrainingDependents),
          );
        }
        if (afterId) {
          const anchorIndex = ranked.findIndex((t) => t.id === afterId);
          const anchor = ranked[anchorIndex];
          if (!anchor) {
            return err(
              new AppError('NOT_FOUND', `Anchor task not found among active tasks: ${afterId}`),
            );
          }
          const next = ranked[anchorIndex + 1];
          return ok(next ? midpoint(anchor.rank, next.rank) : anchor.rank + RANK_GAP);
        }
        if (beforeId) {
          const anchorIndex = ranked.findIndex((t) => t.id === beforeId);
          const anchor = ranked[anchorIndex];
          if (!anchor) {
            return err(
              new AppError('NOT_FOUND', `Anchor task not found among active tasks: ${beforeId}`),
            );
          }
          const prev = ranked[anchorIndex - 1];
          return ok(prev ? midpoint(prev.rank, anchor.rank) : anchor.rank - RANK_GAP);
        }
        // position is defined — guaranteed by the specifiedCount === 1 check above.
        const pos = position as number;
        if (pos < 1) {
          return err(new AppError('VALIDATION', 'Position must be >= 1'));
        }
        if (pos === 1) {
          return ok(this.computeTopRank(ranked));
        }
        if (pos > ranked.length) {
          const minTerminalResult = this.repo.getMinTerminalRankByLevel(projectId, taskLevel);
          if (!minTerminalResult.ok) return minTerminalResult;
          return ok(this.computeBottomRank(ranked, minTerminalResult.value));
        }
        const above = ranked[pos - 2];
        const below = ranked[pos - 1];
        if (!above || !below) {
          return err(new AppError('DB_ERROR', 'Unexpected missing neighbor tasks'));
        }
        return ok(midpoint(above.rank, below.rank));
      };

      let computed = attempt();
      if (!computed.ok) return computed;
      if (computed.value === null) {
        const rb = this.repo.rebalanceByLevel(projectId, taskLevel);
        if (!rb.ok) return rb;
        computed = attempt();
        if (!computed.ok) return computed;
        if (computed.value === null) {
          return err(new AppError('DB_ERROR', 'Rank computation did not converge after rebalance'));
        }
      }
      const newRank = computed.value;

      // Dependency constraint: a blocked task must not rank higher (lower number)
      // than any of its blockers, and must not rank lower than any of its dependents.
      // top/bottom clamp these constraints upstream, so this check should only
      // trip for explicit --after/--before/--position requests.
      for (const blocker of constrainingBlockers) {
        if (newRank < blocker.rank) {
          return err(
            new AppError(
              'VALIDATION',
              `Cannot rank above blocker "${blocker.id}" (${blocker.name}). Complete or remove the dependency first.`,
            ),
          );
        }
      }
      for (const dep of constrainingDependents) {
        if (newRank > dep.rank) {
          return err(
            new AppError(
              'VALIDATION',
              `Cannot rank below dependent "${dep.id}" (${dep.name}). Complete or remove the dependency first.`,
            ),
          );
        }
      }

      return this.repo.rerank(taskId, newRank);
    });
  }

  searchTasks(query: string, projectIdOrName?: string): Result<SearchResult[]> {
    return logger.startSpan('TaskService.searchTasks', () => {
      if (!query.trim()) {
        return err(new AppError('VALIDATION', 'Search query cannot be empty'));
      }

      let projectId: string | undefined;
      if (projectIdOrName) {
        const projectResult = this.projectService.resolveProject(projectIdOrName);
        if (!projectResult.ok) return projectResult;
        projectId = projectResult.value.id;
      }

      return this.repo.search(query, projectId);
    });
  }

  /**
   * Rank for placing a task at the top of the active list. Clamps to
   * "immediately after the highest-ranked blocker" when blockers exist
   * rather than returning a value that would fail validation.
   *
   * Returns `null` to signal FP precision collapse (caller rebalances).
   */
  private computeTopRank(ranked: Task[], constrainingBlockers: Task[] = []): number | null {
    if (constrainingBlockers.length > 0) {
      const highestBlocker = constrainingBlockers.reduce((a, b) => (a.rank > b.rank ? a : b));
      const idx = ranked.findIndex((t) => t.id === highestBlocker.id);
      if (idx >= 0) {
        const next = ranked[idx + 1];
        return next ? midpoint(highestBlocker.rank, next.rank) : highestBlocker.rank + RANK_GAP;
      }
    }
    const first = ranked[0];
    return first ? first.rank - RANK_GAP : RANK_GAP;
  }

  /**
   * Rank for placing a task at the bottom of the active list.
   * - Stays above terminal tasks: terminal tasks live at `maxRank + RANK_GAP`
   *   so a naive `last.rank + RANK_GAP` would collide with the most-recently
   *   completed task.
   * - Clamps above any dependents rather than failing validation.
   *
   * `minTerminal` is passed in so this helper stays pure (no DB access).
   * Returns `null` to signal FP precision collapse.
   */
  private computeBottomRank(
    ranked: Task[],
    minTerminal: number | null,
    constrainingDependents: Task[] = [],
  ): number | null {
    if (constrainingDependents.length > 0) {
      const lowestDependent = constrainingDependents.reduce((a, b) => (a.rank < b.rank ? a : b));
      const idx = ranked.findIndex((t) => t.id === lowestDependent.id);
      if (idx >= 0) {
        const prev = ranked[idx - 1];
        return prev ? midpoint(prev.rank, lowestDependent.rank) : lowestDependent.rank - RANK_GAP;
      }
    }
    const last = ranked[ranked.length - 1];
    if (!last) return RANK_GAP;
    return minTerminal !== null && minTerminal > last.rank
      ? midpoint(last.rank, minTerminal)
      : last.rank + RANK_GAP;
  }

  /**
   * Auto-propagate status to the parent task after a child status change.
   * - If a child moves to in-progress and parent is backlog/todo → parent becomes in-progress.
   * - If all children are terminal (done/cancelled) → parent becomes done.
   */
  private propagateParentStatus(child: Task): void {
    if (!child.parentId) return;

    const parentResult = this.repo.findById(child.parentId);
    if (!parentResult.ok || !parentResult.value) return;
    const parent = parentResult.value;

    // Re-read the child to get its current (post-update) status
    const updatedChildResult = this.repo.findById(child.id);
    if (!updatedChildResult.ok || !updatedChildResult.value) return;
    const updatedChild = updatedChildResult.value;

    // Child moved to in-progress → promote parent from backlog/todo to in-progress
    if (
      updatedChild.status === TaskStatus.InProgress &&
      (parent.status === TaskStatus.Backlog || parent.status === TaskStatus.Todo)
    ) {
      this.repo.update(parent.id, { status: TaskStatus.InProgress });
      return;
    }

    // Child became terminal → check if ALL children are terminal → parent becomes done
    if (isTerminalStatus(updatedChild.status)) {
      const siblingsResult = this.repo.findMany({
        projectId: parent.projectId,
        parentId: parent.id,
      });
      if (!siblingsResult.ok) return;
      const allTerminal = siblingsResult.value.every((s) => isTerminalStatus(s.status));
      if (allTerminal && !isTerminalStatus(parent.status)) {
        const maxRankResult = this.repo.getMaxRankByLevel(
          parent.projectId,
          getTaskLevel(parent.type),
        );
        this.repo.update(parent.id, { status: TaskStatus.Done });
        if (maxRankResult.ok) {
          this.repo.rerank(parent.id, maxRankResult.value + RANK_GAP);
        }
      }
    }
  }
}
