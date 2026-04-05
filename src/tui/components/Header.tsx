import { Box, Text } from 'ink';
import type { AppState } from '../types.js';
import { theme } from '../theme.js';

interface KeyHint {
  key: string;
  desc: string;
}

function getKeyHints(view: string, isSearchActive: boolean, focusedPanel: string): KeyHint[] {
  if (isSearchActive) {
    return [
      { key: 'enter', desc: 'apply' },
      { key: 'esc', desc: 'cancel' },
    ];
  }
  if (view === 'task-list' && focusedPanel === 'epic') {
    return [
      { key: 'j/k', desc: 'nav' },
      { key: 'space', desc: 'toggle' },
      { key: '←', desc: 'reorder' },
      { key: '0', desc: 'clear' },
      { key: 'tab', desc: 'tasks' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  if (view === 'task-list') {
    return [
      { key: 'enter', desc: 'view' },
      { key: 'c', desc: 'create' },
      { key: 'e', desc: 'edit' },
      { key: 'd', desc: 'del' },
      { key: 's', desc: 'status' },
      { key: 'a', desc: 'assign' },
      { key: 'A', desc: 'unassign' },
      { key: '←', desc: 'reorder' },
      { key: '/', desc: 'search' },
      { key: 'p', desc: 'project' },
      { key: 'f', desc: 'status-f' },
      { key: 't', desc: 'type-f' },
      { key: 'tab', desc: 'panel' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  if (view === 'task-detail') {
    return [
      { key: 'e', desc: 'edit' },
      { key: 's', desc: 'status' },
      { key: 'd', desc: 'del' },
      { key: 'm', desc: 'mermaid' },
      { key: 'esc', desc: 'back' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }
  return [
    { key: 'esc', desc: 'back' },
    { key: '?', desc: 'help' },
    { key: 'q', desc: 'quit' },
  ];
}

interface Props {
  state: AppState;
}

export function Header({ state }: Props) {
  const projectName = state.activeProject?.name ?? 'none';
  const taskCount = state.tasks.length;
  const hints = getKeyHints(state.activeView, state.isSearchActive, state.focusedPanel);

  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Text color={theme.logo} bold>
          Tayto
        </Text>
        <Text color={theme.logo}>Project:</Text>
        <Text color="white" bold>
          {projectName}
        </Text>
        <Text dimColor>|</Text>
        <Text color={theme.logo}>Tasks:</Text>
        <Text color="white" bold>
          {taskCount}
        </Text>
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        {hints.map((h) => (
          <Box key={h.key}>
            <Text color={theme.menu.key} bold>
              &lt;{h.key}&gt;
            </Text>
            <Text dimColor>{h.desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
