import { Box, Text } from 'ink';
import type { ViewType } from '../types.js';
import { theme } from '../theme.js';

const VIEW_LABELS: Record<string, string> = {
  'task-list': 'tasks',
  'task-detail': 'detail',
  'task-create': 'create',
  'task-edit': 'edit',
  'project-selector': 'projects',
  help: 'help',
  settings: 'settings',
};

interface Props {
  breadcrumbs: ViewType[];
}

export function Crumbs({ breadcrumbs }: Props) {
  return (
    <Box flexDirection="row" gap={0} width="100%">
      {breadcrumbs.map((crumb, i) => {
        const isActive = i === breadcrumbs.length - 1;
        const label = ` ${VIEW_LABELS[crumb] ?? crumb} `;
        return (
          <Text
            key={`${crumb}-${i}`}
            color={theme.crumb.fg}
            backgroundColor={isActive ? theme.crumb.activeBg : theme.crumb.bg}
            bold={isActive}
          >
            {label}
          </Text>
        );
      })}
    </Box>
  );
}
