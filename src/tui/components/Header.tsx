import { Box, Text } from 'ink';
import type { AppState } from '../types.js';
import { ViewType } from '../types.js';
import { theme } from '../theme.js';
import { Logo } from './Logo.js';
import { ChangelogTicker } from './ChangelogTicker.js';

interface KeyHint {
  key: string;
  desc: string;
}

function getKeyHints(state: AppState): KeyHint[] {
  const { activeView, isSearchActive, isReordering, isEpicReordering, isAddingDep, focusedPanel } =
    state;

  if (state.changelogDialogOpen) {
    return [
      { key: '↑/↓', desc: 'navigate' },
      { key: 'esc', desc: 'close' },
    ];
  }

  if (isAddingDep) {
    return [
      { key: 'type', desc: 'search' },
      { key: 'enter', desc: 'confirm' },
      { key: 'esc', desc: 'cancel' },
    ];
  }

  const REORDER_SUFFIX: KeyHint[] = [
    { key: '→', desc: 'save' },
    { key: 't', desc: 'top' },
    { key: 'b', desc: 'bottom' },
    { key: 'esc/←', desc: 'cancel' },
  ];

  if (isReordering) return [{ key: '↑/↓', desc: 'move' }, ...REORDER_SUFFIX];
  if (isEpicReordering) return [{ key: '↑/↓', desc: 'move epic' }, ...REORDER_SUFFIX];

  if (isSearchActive) {
    return [
      { key: 'type', desc: 'query' },
      { key: 'enter', desc: 'apply' },
      { key: 'esc', desc: 'cancel' },
    ];
  }

  if (activeView === ViewType.TaskList && focusedPanel === 'epic') {
    return [
      { key: 'j/k', desc: 'nav' },
      { key: 'space', desc: 'toggle' },
      { key: '0', desc: 'clear' },
      { key: '←', desc: 'reorder' },
      { key: 'tab/S-tab', desc: 'panel' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }

  if (activeView === ViewType.TaskList && focusedPanel === 'detail') {
    return [
      { key: 'j/k', desc: 'scroll' },
      { key: 'e', desc: 'edit' },
      { key: 's', desc: 'status' },
      { key: 'd', desc: 'del' },
      { key: 'm', desc: 'mermaid' },
      { key: 'D', desc: 'deps' },
      { key: 'tab/S-tab', desc: 'panel' },
      { key: '?', desc: 'help' },
    ];
  }

  if (activeView === ViewType.Settings) {
    return [
      { key: '1', desc: 'tasks' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }

  if (activeView === ViewType.TaskList) {
    return [
      { key: 'enter', desc: 'view' },
      { key: 'c', desc: 'create' },
      { key: 'e', desc: 'edit' },
      { key: 'd', desc: 'del' },
      { key: 's', desc: 'status' },
      { key: 'a/A', desc: 'assign' },
      { key: '←', desc: 'reorder' },
      { key: '/', desc: 'search' },
      { key: 'p', desc: 'project' },
      { key: 'f/t', desc: 'filter' },
      { key: 'PgDn/Up', desc: 'page' },
      { key: 'tab/S-tab', desc: 'panel' },
      { key: '2', desc: 'settings' },
      { key: '?', desc: 'help' },
      { key: 'q', desc: 'quit' },
    ];
  }

  if (activeView === ViewType.TaskDetail) {
    return [
      { key: 'e', desc: 'edit' },
      { key: 's', desc: 'status' },
      { key: 'd', desc: 'del' },
      { key: 'm', desc: 'mermaid' },
      { key: 'D', desc: 'deps' },
      { key: 'j/k', desc: 'scroll' },
      { key: 'esc', desc: 'back' },
      { key: '?', desc: 'help' },
    ];
  }

  if (activeView === ViewType.DependencyList) {
    return [
      { key: 'a', desc: 'add blocker' },
      { key: 'x', desc: 'remove' },
      { key: 'enter', desc: 'goto task' },
      { key: 'esc', desc: 'back' },
      { key: '?', desc: 'help' },
    ];
  }

  if (activeView === ViewType.TaskCreate || activeView === ViewType.TaskEdit) {
    return [
      { key: '↑↓/tab', desc: 'navigate' },
      { key: '←→', desc: 'cursor' },
      { key: 'ctrl+s', desc: 'save' },
      { key: 'esc', desc: 'cancel' },
    ];
  }

  if (activeView === ViewType.ProjectSelector) {
    return [
      { key: 'j/k', desc: 'nav' },
      { key: 'enter', desc: 'select' },
      { key: 'e', desc: 'edit' },
      { key: 'c', desc: 'create' },
      { key: 'l', desc: 'link' },
      { key: 'd', desc: 'default' },
      { key: 'esc', desc: 'back' },
    ];
  }

  if (activeView === ViewType.EpicPicker) {
    return [
      { key: 'j/k', desc: 'nav' },
      { key: 'enter', desc: 'select' },
      { key: 'esc', desc: 'cancel' },
    ];
  }

  return [
    { key: 'esc', desc: 'back' },
    { key: '?', desc: 'help' },
    { key: 'q', desc: 'quit' },
  ];
}

/** Split hints into N roughly-equal columns for compact layout. */
function chunkHints(hints: KeyHint[], cols: number): KeyHint[][] {
  const perCol = Math.ceil(hints.length / cols);
  const result: KeyHint[][] = [];
  for (let i = 0; i < hints.length; i += perCol) {
    result.push(hints.slice(i, i + perCol));
  }
  return result;
}

interface Props {
  state: AppState;
  latestVersion?: string | undefined;
}

export function Header({ state, latestVersion }: Props) {
  const projectName = state.activeProject?.name ?? 'none';
  const taskCount = state.tasks.length;
  const hints = getKeyHints(state);

  const hintCols = hints.length <= 7 ? 2 : hints.length <= 12 ? 3 : 4;
  const columns = chunkHints(hints, hintCols);
  const hasTicker = state.changelogEntries !== null;

  return (
    <Box flexDirection="row" gap={1}>
      <Box flexShrink={0}>
        <Logo />
      </Box>

      <Box flexDirection="column" justifyContent="center" flexShrink={0} paddingLeft={1}>
        <Text color={theme.logo} bold>
          tayto
        </Text>
        <Box gap={1}>
          <Text color={theme.fg}>Project:</Text>
          <Text color={theme.titleCounter} bold>
            {projectName}
          </Text>
        </Box>
        <Box gap={1}>
          <Text color={theme.fg}>Tasks:</Text>
          <Text color={theme.titleCounter} bold>
            {taskCount}
          </Text>
        </Box>
        {latestVersion && (
          <Box gap={1}>
            <Text color={theme.flash.warn}>Update {latestVersion}</Text>
            <Text color={theme.fg}>— tayto upgrade</Text>
          </Box>
        )}
      </Box>

      {hasTicker && state.changelogEntries ? (
        <>
          <Box flexGrow={1} justifyContent="center">
            <ChangelogTicker entries={state.changelogEntries} />
          </Box>
          <Box flexShrink={0}>
            <HintGrid columns={columns} />
          </Box>
        </>
      ) : (
        <Box flexGrow={1} justifyContent="flex-end">
          <HintGrid columns={columns} />
        </Box>
      )}
    </Box>
  );
}

interface HintGridProps {
  columns: Array<Array<{ key: string; desc: string }>>;
}

function HintGrid({ columns }: HintGridProps) {
  return (
    <Box flexDirection="row" gap={2}>
      {columns.map((col, ci) => (
        <Box key={col[0]?.key ?? String(ci)} flexDirection="column">
          {col.map((h) => (
            <Box key={h.key}>
              <Text color={theme.menu.key} bold>
                &lt;{h.key}&gt;
              </Text>
              <Text color={theme.menu.desc}>{h.desc}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
