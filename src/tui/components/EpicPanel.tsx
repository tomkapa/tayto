import { Box, Text } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_COLOR } from '../constants.js';

const PAGE_SIZE = 20;

interface Props {
  epics: Task[];
  selectedIndex: number;
  selectedEpicIds: Set<string>;
  isFocused: boolean;
  isReordering?: boolean;
}

export function EpicPanel({
  epics,
  selectedIndex,
  selectedEpicIds,
  isFocused,
  isReordering = false,
}: Props) {
  const filterActive = selectedEpicIds.size > 0;
  const currentPage = Math.floor(selectedIndex / PAGE_SIZE);
  const viewStart = currentPage * PAGE_SIZE;
  const visibleEpics = epics.slice(viewStart, viewStart + PAGE_SIZE);

  return (
    <Box
      flexDirection="column"
      width={48}
      borderStyle="bold"
      borderColor={isFocused ? theme.borderFocus : theme.border}
    >
      <Box>
        <Text color={theme.title} bold>
          {' '}
          epics
        </Text>
        <Text color={theme.titleCounter} bold>
          [{epics.length}]
        </Text>
        {isReordering && (
          <Text color={theme.flash.warn} bold>
            {' '}
            REORDER
          </Text>
        )}
        {filterActive && <Text color={theme.titleFilter}> *{selectedEpicIds.size}</Text>}
      </Box>

      {epics.length === 0 ? (
        <Box paddingX={1}>
          <Text dimColor>No epics</Text>
        </Box>
      ) : (
        visibleEpics.map((epic, i) => {
          const actualIndex = viewStart + i;
          const isSelected = actualIndex === selectedIndex && isFocused;
          const isChecked = selectedEpicIds.has(epic.id);
          const marker = isChecked ? '[x]' : '[ ]';
          const statusColor = STATUS_COLOR[epic.status] ?? theme.table.fg;

          if (isSelected) {
            const cursorBg = isReordering ? theme.flash.warn : theme.table.cursorBg;
            return (
              <Box key={epic.id}>
                <Text backgroundColor={cursorBg} color={theme.table.cursorFg} bold>
                  {isReordering ? '~ ' : ' '}
                  {marker} {epic.name}
                </Text>
              </Box>
            );
          }

          return (
            <Box key={epic.id}>
              <Text color={isChecked ? theme.titleHighlight : statusColor}>
                {' '}
                {marker} {epic.name}
              </Text>
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />

      {epics.length > PAGE_SIZE && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + PAGE_SIZE, epics.length)}/{epics.length}]
          </Text>
        </Box>
      )}
    </Box>
  );
}
