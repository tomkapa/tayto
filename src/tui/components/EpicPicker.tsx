import { useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_COLOR } from '../constants.js';

interface Props {
  epics: Task[];
  /** Currently assigned epic ID (highlighted in the list). */
  currentEpicId: string | null;
  onSelect: (epicId: string | null) => void;
  onCancel: () => void;
}

export function EpicPicker({ epics, currentEpicId, onSelect, onCancel }: Props) {
  const { stdout } = useStdout();
  const termHeight = stdout.rows > 0 ? stdout.rows : 24;
  const maxVisible = Math.max(3, termHeight - 10);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [cursorIndex, setCursorIndex] = useState(0);

  const filtered = epics.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.id.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  });

  let viewStart = 0;
  if (cursorIndex >= viewStart + maxVisible) {
    viewStart = cursorIndex - maxVisible + 1;
  }
  if (cursorIndex < viewStart) {
    viewStart = cursorIndex;
  }
  const visible = filtered.slice(viewStart, viewStart + maxVisible);

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) {
        setIsSearching(false);
        return;
      }
      if (key.return) {
        setIsSearching(false);
        setCursorIndex(0);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery((q) => q.slice(0, -1));
        setCursorIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery((q) => q + input);
        setCursorIndex(0);
        return;
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setCursorIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursorIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (key.return) {
      const epic = filtered[cursorIndex];
      if (epic) {
        onSelect(epic.id);
      }
      return;
    }

    // x: unassign (set parent to null)
    if (input === 'x') {
      onSelect(null);
      return;
    }

    if (input === '/') {
      setIsSearching(true);
      setSearchQuery('');
      return;
    }

    if (key.escape || input === 'q') {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column" borderStyle="bold" borderColor={theme.borderFocus} flexGrow={1}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          assign to epic
        </Text>
        <Text color={theme.titleCounter} bold>
          {' '}
          [{epics.length}]
        </Text>
      </Box>

      {isSearching ? (
        <Box borderStyle="round" borderColor={theme.prompt} paddingX={1}>
          <Text color={theme.prompt}>/</Text>
          <Text color={theme.prompt}>{searchQuery}</Text>
          <Text color={theme.promptSuggest}>_</Text>
        </Box>
      ) : searchQuery ? (
        <Box paddingX={1}>
          <Text color={theme.titleFilter}>/{searchQuery}</Text>
        </Box>
      ) : null}

      <Box paddingX={1}>
        <Text color={theme.table.headerFg} bold>
          {'  '}
          {'ID'.padEnd(14)}
          {'STATUS'.padEnd(14)}
          {'NAME'}
        </Text>
      </Box>

      {filtered.length === 0 ? (
        <Box paddingX={2} paddingY={1}>
          <Text dimColor>No epics match the filter</Text>
        </Box>
      ) : (
        visible.map((epic, i) => {
          const actualIndex = viewStart + i;
          const isCursor = actualIndex === cursorIndex;
          const isCurrent = epic.id === currentEpicId;
          const marker = isCurrent ? '* ' : '  ';
          const statusColor = STATUS_COLOR[epic.status] ?? theme.table.fg;

          return (
            <Box key={epic.id} paddingX={1}>
              {isCursor ? (
                <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
                  {'> '}
                  {epic.id.padEnd(14)}
                  {epic.status.padEnd(14)}
                  {epic.name}
                </Text>
              ) : (
                <>
                  <Text color={isCurrent ? theme.titleHighlight : theme.table.fg}>{marker}</Text>
                  <Text color={theme.yaml.value}>{epic.id.padEnd(14)}</Text>
                  <Text color={statusColor}>{epic.status.padEnd(14)}</Text>
                  <Text color={isCurrent ? theme.titleHighlight : theme.table.fg}>{epic.name}</Text>
                </>
              )}
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />

      {filtered.length > maxVisible && (
        <Box justifyContent="flex-end" paddingRight={1}>
          <Text dimColor>
            [{viewStart + 1}-{Math.min(viewStart + maxVisible, filtered.length)}/{filtered.length}]
          </Text>
        </Box>
      )}

      <Box paddingX={1}>
        <Text dimColor>enter: assign | x: unassign | /: search | esc: cancel</Text>
      </Box>
    </Box>
  );
}
