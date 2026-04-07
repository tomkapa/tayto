import { Box, Text } from 'ink';
import { theme } from '../theme.js';

const SECTIONS = [
  {
    title: 'NAVIGATION',
    keys: [
      ['j/k', 'Up/Down'],
      ['g/G', 'Top/Bottom'],
      ['PgDn', 'Page down'],
      ['PgUp', 'Page up'],
      ['enter', 'View'],
      ['esc', 'Back'],
    ],
  },
  {
    title: 'ACTIONS',
    keys: [
      ['c', 'Create'],
      ['e', 'Edit'],
      ['d', 'Delete'],
      ['s', 'Status cycle'],
      ['D', 'Dependencies'],
    ],
  },
  {
    title: 'REORDER',
    keys: [
      ['←', 'Enter reorder'],
      ['↑↓', 'Move task'],
      ['t', 'Jump to top'],
      ['b', 'Jump to bottom'],
      ['→', 'Save position'],
      ['esc/←', 'Cancel'],
    ],
  },
  {
    title: 'FILTER',
    keys: [
      ['/', 'Search'],
      ['f', 'Status filter'],
      ['t', 'Type filter'],
      ['0', 'Clear filters'],
    ],
  },
  {
    title: 'DEPS VIEW',
    keys: [
      ['a', 'Add blocker'],
      ['x', 'Remove dep'],
      ['enter', 'Go to task'],
      ['esc', 'Back'],
    ],
  },
  {
    title: 'GENERAL',
    keys: [
      ['p', 'Projects'],
      ['?', 'Help'],
      ['q', 'Quit'],
    ],
  },
];

export function HelpOverlay() {
  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={theme.borderFocus}
      paddingX={2}
      paddingY={1}
    >
      <Text color={theme.title} bold>
        {' '}
        Help
      </Text>
      <Text> </Text>
      <Box flexDirection="row" gap={4}>
        {SECTIONS.map((section) => (
          <Box key={section.title} flexDirection="column">
            <Text color={theme.table.headerFg} bold>
              {section.title}
            </Text>
            {section.keys.map(([key, desc]) => (
              <Box key={key} gap={1}>
                <Text color={theme.menu.key} bold>
                  {'<'}
                  {(key ?? '').padEnd(5)}
                  {'>'}
                </Text>
                <Text dimColor>{desc}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Text> </Text>
      <Text dimColor>Press any key to close</Text>
    </Box>
  );
}
