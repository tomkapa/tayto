import { Box, Text } from 'ink';
import { theme } from '../theme.js';

export function SettingsView() {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.border}>
      <Box>
        <Text color={theme.title} bold>
          {' settings'}
        </Text>
      </Box>
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text dimColor>No settings available yet</Text>
      </Box>
    </Box>
  );
}
