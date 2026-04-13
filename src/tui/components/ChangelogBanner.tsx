import { Box, Text } from 'ink';
import type { ChangelogEntry } from '../../utils/changelog-parser.js';
import { theme } from '../theme.js';

interface Props {
  entries: ChangelogEntry[];
  currentIndex: number;
}

export function ChangelogBanner({ entries, currentIndex }: Props) {
  const entry = entries[currentIndex];
  if (!entry) return null;

  const total = entries.length;

  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={theme.borderFocus}
      paddingX={3}
      paddingY={1}
      gap={1}
      alignSelf="center"
    >
      <Text color={theme.dialog.label} bold>
        {`<What's New — v${entry.version}${entry.date ? ` (${entry.date})` : ''}>`}
      </Text>

      {entry.sections.map((section) => (
        <Box key={section.heading} flexDirection="column">
          <Text color={theme.table.headerFg} bold>
            {`### ${section.heading}`}
          </Text>
          {section.items.map((item, i) => (
            <Text key={`${section.heading}-${i}`} color={theme.dialog.fg}>
              {`- ${item}`}
            </Text>
          ))}
        </Box>
      ))}

      <Box gap={2}>
        <Text color={theme.fg}>{`[${currentIndex + 1}/${total}]`}</Text>
        <Text color={theme.menu.desc}>↑/↓: navigate</Text>
        <Text color={theme.menu.desc}>esc: close</Text>
      </Box>
    </Box>
  );
}
