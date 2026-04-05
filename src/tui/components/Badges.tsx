import { Text } from 'ink';
import { TaskStatus, TaskType } from '../../types/enums.js';
import { theme } from '../theme.js';

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  [TaskStatus.Backlog]: { label: 'BACKLOG', color: theme.status.completed },
  [TaskStatus.Todo]: { label: 'TODO', color: theme.status.new },
  [TaskStatus.InProgress]: { label: 'IN-PROG', color: theme.status.pending },
  [TaskStatus.Review]: { label: 'REVIEW', color: theme.status.modified },
  [TaskStatus.Done]: { label: 'DONE', color: theme.status.added },
  [TaskStatus.Cancelled]: { label: 'CANCEL', color: theme.status.kill },
};

const TYPE_DISPLAY: Record<string, { label: string; color: string }> = {
  [TaskType.Epic]: { label: 'epic', color: theme.status.modified },
  [TaskType.Story]: { label: 'story', color: theme.status.highlight },
  [TaskType.TechDebt]: { label: 'debt', color: theme.status.pending },
  [TaskType.Bug]: { label: 'bug', color: theme.status.error },
};

export function StatusBadge({ status }: { status: string }) {
  const display = STATUS_DISPLAY[status] ?? { label: status, color: 'white' };
  return <Text color={display.color}>{display.label.padEnd(7)}</Text>;
}

export function TypeBadge({ type }: { type: string }) {
  const display = TYPE_DISPLAY[type] ?? { label: type, color: 'white' };
  return <Text color={display.color}>{display.label.padEnd(5)}</Text>;
}
