import { Box, Text } from 'ink';
import type { TopTab } from '../types.js';
import { theme } from '../theme.js';

interface Props {
  activeTab: TopTab;
}

export function TabBar({ activeTab }: Props) {
  const tabs: Array<{ id: TopTab; label: string }> = [
    { id: 'tasks', label: ' Tasks ' },
    { id: 'settings', label: ' Settings ' },
  ];

  return (
    <Box flexDirection="row" gap={0} width="100%">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <Text
            key={tab.id}
            color={theme.crumb.fg}
            backgroundColor={isActive ? theme.crumb.activeBg : theme.crumb.bg}
            bold={isActive}
          >
            {tab.label}
          </Text>
        );
      })}
    </Box>
  );
}
