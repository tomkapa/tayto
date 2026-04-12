import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Project } from '../../types/project.js';
import { theme } from '../theme.js';

interface Props {
  projects: Project[];
  activeProject: Project | null;
  onSelect: (project: Project) => void;
  onCreate: () => void;
  onEdit: (project: Project) => void;
  onSetDefault: (project: Project) => void;
  onLink: (project: Project) => void;
  onCancel: () => void;
}

export function ProjectSelector({
  projects,
  activeProject,
  onSelect,
  onCreate,
  onEdit,
  onSetDefault,
  onLink,
  onCancel,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState(() => {
    if (!activeProject) return 0;
    const idx = projects.findIndex((p) => p.id === activeProject.id);
    return idx >= 0 ? idx : 0;
  });

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      onCancel();
      return;
    }
    if (key.return) {
      const project = projects[selectedIndex];
      if (project) {
        onSelect(project);
      }
      return;
    }
    if (input === 'c') {
      onCreate();
      return;
    }
    if (input === 'e') {
      const project = projects[selectedIndex];
      if (project) {
        onEdit(project);
      }
      return;
    }
    if (input === 'd') {
      const project = projects[selectedIndex];
      if (project) {
        onSetDefault(project);
      }
      return;
    }
    if (input === 'l') {
      const project = projects[selectedIndex];
      if (project) {
        onLink(project);
      }
      return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex((i) => Math.max(0, i - 1));
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex((i) => Math.min(projects.length - 1, i + 1));
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      {/* Title bar */}
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          projects
        </Text>
        <Text color={theme.titleCounter} bold>
          [{projects.length}]
        </Text>
      </Box>

      {/* Table header */}
      <Box paddingX={1}>
        <Text color={theme.table.headerFg} bold>
          {'  NAME'.padEnd(30)}
        </Text>
        <Text color={theme.table.headerFg} bold>
          {'GIT REMOTE'.padEnd(40)}
        </Text>
        <Text color={theme.table.headerFg} bold>
          DESCRIPTION
        </Text>
      </Box>

      {projects.length === 0 ? (
        <Box paddingX={1} paddingY={1}>
          <Text color={theme.fg}>No projects. Press &apos;c&apos; to create one.</Text>
        </Box>
      ) : (
        projects.map((project, i) => {
          const isSelected = i === selectedIndex;
          const isActive = project.id === activeProject?.id;
          // * = active project, D = default project, combines to *D when both
          const activeMarker = isActive ? '*' : ' ';
          const defaultMarker = project.isDefault ? 'D' : ' ';
          const marker = `${activeMarker}${defaultMarker}`;

          const remoteDisplay = (project.gitRemote ?? '').slice(0, 38).padEnd(40);

          if (isSelected) {
            return (
              <Box key={project.id} paddingX={1}>
                <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
                  {marker} {project.name.padEnd(27)}
                  {remoteDisplay}
                  {project.description}
                </Text>
              </Box>
            );
          }

          return (
            <Box key={project.id} paddingX={1}>
              <Text color={isActive ? theme.status.modified : theme.table.fg}>
                {marker} {project.name.padEnd(27)}
              </Text>
              <Text dimColor>{remoteDisplay}</Text>
              <Text dimColor>{project.description}</Text>
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />

      <Box paddingX={1}>
        <Text dimColor>
          enter: select | e: edit | d: set default | l: link git | c: create | esc: back
        </Text>
      </Box>
    </Box>
  );
}
