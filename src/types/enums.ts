export const TaskStatus = {
  Backlog: 'backlog',
  Todo: 'todo',
  InProgress: 'in-progress',
  Review: 'review',
  Done: 'done',
  Cancelled: 'cancelled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskType = {
  Epic: 'epic',
  Story: 'story',
  TechDebt: 'tech-debt',
  Bug: 'bug',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

/**
 * Task level derived from type.
 * Level 1: epics (grouping/planning layer)
 * Level 2: stories, tech-debt, bugs (execution layer)
 */
export const TaskLevel = {
  Epic: 1,
  Work: 2,
} as const;
export type TaskLevel = (typeof TaskLevel)[keyof typeof TaskLevel];

const TYPE_TO_LEVEL: Record<string, TaskLevel> = {
  [TaskType.Epic]: TaskLevel.Epic,
  [TaskType.Story]: TaskLevel.Work,
  [TaskType.TechDebt]: TaskLevel.Work,
  [TaskType.Bug]: TaskLevel.Work,
};

export function getTaskLevel(type: string): TaskLevel {
  return TYPE_TO_LEVEL[type] ?? TaskLevel.Work;
}

/** Types that belong to the work (level 2) execution layer. */
export const WORK_TYPES: ReadonlySet<string> = new Set([
  TaskType.Story,
  TaskType.TechDebt,
  TaskType.Bug,
]);

/** Types stored in the database. */
export const DependencyType = {
  Blocks: 'blocks',
  RelatesTo: 'relates-to',
  Duplicates: 'duplicates',
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

/**
 * UI-level dependency types — includes BlockedBy which is a reverse-Blocks
 * relationship resolved before persisting to the database.
 */
export const UIDependencyType = {
  ...DependencyType,
  BlockedBy: 'blocked-by',
} as const;
export type UIDependencyType = (typeof UIDependencyType)[keyof typeof UIDependencyType];

/** Gap between consecutive rank values, used for insertion between neighbors. */
export const RANK_GAP = 1000.0;

/**
 * Collapse-safe midpoint between two rank values. Returns `null` when
 * IEEE 754 double precision cannot represent a strictly-between value —
 * callers use this as a signal to rebalance the rank grid and retry.
 * Returning a number unconditionally would silently collide with an
 * endpoint and corrupt the task ordering.
 */
export function midpoint(a: number, b: number): number | null {
  const m = (a + b) / 2;
  return m > a && m < b ? m : null;
}

/** Statuses that represent terminal/completed task states. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  TaskStatus.Done,
  TaskStatus.Cancelled,
]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
