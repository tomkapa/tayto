import { TaskStatus, TaskType, DependencyType, UIDependencyType } from '../types/enums.js';
import { theme } from './theme.js';

export const STATUS_VALUES = Object.values(TaskStatus);
export const TYPE_VALUES = Object.values(TaskType);

export const STATUS_COLOR: Record<string, string> = {
  [TaskStatus.Backlog]: theme.status.completed,
  [TaskStatus.Todo]: theme.status.new,
  [TaskStatus.InProgress]: theme.status.pending,
  [TaskStatus.Review]: theme.status.modified,
  [TaskStatus.Done]: theme.status.added,
  [TaskStatus.Cancelled]: theme.status.kill,
};

export const TYPE_COLOR: Record<string, string> = {
  [TaskType.Epic]: theme.status.modified,
  [TaskType.Story]: theme.status.highlight,
  [TaskType.TechDebt]: theme.status.pending,
  [TaskType.Bug]: theme.status.error,
};

export const DEP_TYPE_LABEL: Record<string, string> = {
  [DependencyType.Blocks]: 'blocks',
  [DependencyType.RelatesTo]: 'relates-to',
  [DependencyType.Duplicates]: 'duplicates',
  [UIDependencyType.BlockedBy]: 'blocked-by',
};
