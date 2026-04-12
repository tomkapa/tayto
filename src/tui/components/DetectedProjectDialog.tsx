import { Box, Text } from 'ink';
import type { GitRemote } from '../../types/git-remote.js';
import { theme } from '../theme.js';

interface Props {
  remote: GitRemote;
}

export function DetectedProjectDialog({ remote }: Props) {
  return (
    <Box
      flexDirection="column"
      borderStyle="bold"
      borderColor={theme.borderFocus}
      paddingX={3}
      paddingY={1}
      alignSelf="center"
    >
      <Text color={theme.dialog.label} bold>
        {'<New Repo Detected>'}
      </Text>
      <Text> </Text>
      <Text color={theme.dialog.fg}>
        Git remote: <Text bold>{remote.value}</Text>
      </Text>
      <Text color={theme.dialog.fg}>No project is linked to this repo yet.</Text>
      <Text color={theme.dialog.fg}>Would you like to create one and link it?</Text>
      <Text> </Text>
      <Box gap={3}>
        <Text backgroundColor={theme.dialog.buttonFocusBg} color={theme.dialog.buttonFocusFg} bold>
          {' y: Create '}
        </Text>
        <Text backgroundColor={theme.dialog.buttonBg} color={theme.dialog.buttonFg}>
          {' n: Skip '}
        </Text>
      </Box>
    </Box>
  );
}
