import { useState, useEffect, useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ChangelogEntry } from '../../utils/changelog-parser.js';
import { theme } from '../theme.js';

interface TickerItem {
  version: string;
  section: string;
  text: string;
}

interface Props {
  entries: ChangelogEntry[];
}

const INTERVAL_MS = 4000;
// 75% wider than original 56 → 98 chars
const WIDTH = 98;

export function ChangelogTicker({ entries }: Props) {
  const items = useMemo<TickerItem[]>(
    () =>
      entries.flatMap((entry) =>
        entry.sections.flatMap((section) =>
          section.items.map((item) => ({
            version: entry.version,
            section: section.heading,
            text: item,
          })),
        ),
      ),
    [entries],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [items.length]);

  const current = items[index % Math.max(1, items.length)];
  if (!current) return null;

  return (
    <Box
      borderStyle="bold"
      borderColor={theme.border}
      paddingX={2}
      width={WIDTH}
      flexShrink={0}
      flexDirection="column"
    >
      <Box gap={1}>
        <Text color={theme.dialog.label} bold>{`v${current.version}`}</Text>
        <Text color={theme.border}>·</Text>
        <Text color={theme.table.headerFg}>{current.section}</Text>
      </Box>
      <Box flexDirection="row" gap={1}>
        <Box flexGrow={1}>
          <Text color={theme.fg} wrap="truncate">
            {current.text}
          </Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.menu.key} bold>
            {'<W>'}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
