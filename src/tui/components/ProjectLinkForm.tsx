import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Project } from '../../types/project.js';
import { theme } from '../theme.js';

interface Props {
  project: Project;
  onSave: (remote: string) => void;
  onUnlink: () => void;
  onDetect: () => string | null;
  onCancel: () => void;
}

export function ProjectLinkForm({ project, onSave, onUnlink, onDetect, onCancel }: Props) {
  const [remoteUrl, setRemoteUrl] = useState(project.gitRemote ?? '');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (input === 's' && key.ctrl) {
      const trimmed = remoteUrl.trim();
      if (trimmed) {
        onSave(trimmed);
      }
      return;
    }

    if (input === 'd' && key.ctrl) {
      const detected = onDetect();
      if (detected) {
        setRemoteUrl(detected);
      }
      return;
    }

    if (input === 'u' && key.ctrl) {
      if (project.gitRemote) {
        onUnlink();
      }
      return;
    }

    if (key.backspace || key.delete) {
      setRemoteUrl((v) => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setRemoteUrl((v) => v + input);
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          link git remote
        </Text>
        <Text color={theme.titleCounter} bold>
          {' '}
          [{project.name}]
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box gap={1}>
          <Text color={theme.dialog.label} bold>
            Current:
          </Text>
          <Text
            color={project.gitRemote ? theme.yaml.value : theme.table.fg}
            dimColor={!project.gitRemote}
          >
            {project.gitRemote ?? '(none)'}
          </Text>
        </Box>

        <Box gap={1} marginTop={1}>
          <Text color={theme.dialog.label} bold>
            {'Remote URL: '}
          </Text>
          <Text color={theme.yaml.value}>
            {remoteUrl}
            <Text color={theme.titleHighlight}>_</Text>
          </Text>
        </Box>
      </Box>

      <Box flexGrow={1} />

      <Box paddingX={1}>
        <Text dimColor>ctrl+s: save | ctrl+d: detect from cwd | ctrl+u: unlink | esc: cancel</Text>
      </Box>
    </Box>
  );
}
