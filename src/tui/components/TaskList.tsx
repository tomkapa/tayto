import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_COLOR, TYPE_COLOR } from '../constants.js';
import type { TaskFilter } from '../../types/task.js';
import { PAGE_SIZE } from '../constants.js';

interface Props {
  tasks: Task[];
  selectedIndex: number;
  searchQuery: string;
  isSearchActive: boolean;
  isReordering: boolean;
  filter: TaskFilter;
  activeProjectName: string;
  /** IDs of non-terminal tasks that block the selected task */
  nonTerminalBlockerIds: Set<string>;
  /** IDs of non-terminal tasks that depend on the selected task */
  nonTerminalDependentIds: Set<string>;
  /** True when the selected task has at least one non-terminal blocker */
  isSelectedBlocked: boolean;
  isFocused?: boolean;
  /** True when an epic filter is active (shown in title bar). */
  epicFilterActive?: boolean;
}

// Fixed column widths
const COL = {
  rank: 5,
  type: 12,
  status: 14,
};

export function TaskList({
  tasks,
  selectedIndex,
  searchQuery,
  isSearchActive,
  isReordering,
  filter,
  activeProjectName,
  nonTerminalBlockerIds,
  nonTerminalDependentIds,
  isSelectedBlocked,
  isFocused = true,
  epicFilterActive = false,
}: Props) {
  const currentPage = Math.floor(selectedIndex / PAGE_SIZE);
  const viewStart = currentPage * PAGE_SIZE;

  const visibleTasks = tasks.slice(viewStart, viewStart + PAGE_SIZE);

  // Title bar filters
  const filterParts: string[] = [];
  if (filter.status) filterParts.push(`status:${filter.status}`);
  if (filter.type) filterParts.push(`type:${filter.type}`);
  if (filter.search) filterParts.push(filter.search);
  const filterText = filterParts.length > 0 ? filterParts.join(' ') : '';

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="bold"
      borderColor={isFocused ? theme.borderFocus : theme.border}
    >
      {/* Title bar */}
      <Box>
        <Text color={theme.title} bold>
          {' '}
          tasks
        </Text>
        <Text color={theme.fg}>(</Text>
        <Text color={theme.titleHighlight} bold>
          {activeProjectName}
        </Text>
        <Text color={theme.fg}>)</Text>
        <Text color={theme.titleCounter} bold>
          [{tasks.length}]
        </Text>
        {isReordering && (
          <Text color={theme.flash.warn} bold>
            {' '}
            REORDER
          </Text>
        )}
        {epicFilterActive && <Text color={theme.titleHighlight}> [epic]</Text>}
        {filterText && <Text color={theme.titleFilter}> /{filterText}</Text>}
      </Box>

      {/* Search prompt */}
      {isSearchActive && (
        <Box borderStyle="round" borderColor={theme.prompt} paddingX={1}>
          <Text color={theme.prompt}>/</Text>
          <Text color={theme.prompt}>{searchQuery}</Text>
          <Text color={theme.promptSuggest}>_</Text>
        </Box>
      )}

      {/* Table header */}
      <Box>
        <Text color={theme.table.headerFg} bold>
          {'  '}
        </Text>
        <Text color={theme.table.headerFg} bold>
          {'#'.padEnd(COL.rank)}
        </Text>
        <Text color={theme.table.headerFg} bold>
          {'TYPE'.padEnd(COL.type)}
        </Text>
        <Text color={theme.table.headerFg} bold>
          {'STATUS'.padEnd(COL.status)}
        </Text>
        <Text color={theme.table.headerFg} bold>
          NAME
        </Text>
      </Box>

      {/* Task rows */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {tasks.length === 0 ? (
          <Box paddingX={2} paddingY={1}>
            <Text color={theme.fg}>No tasks found. Press &apos;c&apos; to create one.</Text>
          </Box>
        ) : (
          visibleTasks.map((task, i) => {
            const actualIndex = viewStart + i;
            const isSelected = actualIndex === selectedIndex;
            const isNonTerminalBlocker = nonTerminalBlockerIds.has(task.id);
            const isNonTerminalDependent = nonTerminalDependentIds.has(task.id);
            const rowColor = STATUS_COLOR[task.status] ?? theme.table.fg;
            const rowNum = `${actualIndex + 1}`;

            // Dep marker: ▲ = non-terminal blocker, ▼ = non-terminal dependent
            const depMarker = isNonTerminalBlocker ? '▲ ' : isNonTerminalDependent ? '▼ ' : '  ';

            if (isSelected) {
              // Blue if able to transition, red if blocked by a non-terminal task
              const cursorBg = isReordering
                ? theme.flash.warn
                : isSelectedBlocked
                  ? theme.table.blockedCursorBg
                  : theme.table.cursorBg;
              return (
                <Box key={task.id}>
                  <Text backgroundColor={cursorBg} color={theme.table.cursorFg} bold>
                    {isReordering ? '~ ' : '> '}
                    {rowNum.padEnd(COL.rank)}
                    {task.type.padEnd(COL.type)}
                    {task.status.padEnd(COL.status)}
                    {task.name}
                  </Text>
                </Box>
              );
            }

            if (isNonTerminalBlocker || isNonTerminalDependent) {
              // Lighter blue background for non-terminal related tasks; rank order
              // implicitly conveys direction (higher rank = blocker, lower = dependent).
              return (
                <Box key={task.id}>
                  <Text backgroundColor={theme.table.depHighlightBg} color={theme.table.fg} bold>
                    {depMarker}
                    {rowNum.padEnd(COL.rank)}
                    {task.type.padEnd(COL.type)}
                    {task.status.padEnd(COL.status)}
                    {task.name}
                  </Text>
                </Box>
              );
            }

            return (
              <Box key={task.id}>
                <Text>{'  '}</Text>
                <Text dimColor>{rowNum.padEnd(COL.rank)}</Text>
                <Text color={TYPE_COLOR[task.type] ?? rowColor}>{task.type.padEnd(COL.type)}</Text>
                <Text color={STATUS_COLOR[task.status] ?? rowColor}>
                  {task.status.padEnd(COL.status)}
                </Text>
                <Text color={rowColor}>{task.name}</Text>
              </Box>
            );
          })
        )}
      </Box>

      {/* Page indicator */}
      {tasks.length > PAGE_SIZE && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + PAGE_SIZE, tasks.length)}/{tasks.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
