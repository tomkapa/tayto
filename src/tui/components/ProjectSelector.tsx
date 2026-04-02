import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Project } from '../../types/project.js';
import { theme } from '../theme.js';

interface Props {
  projects: Project[];
  activeProject: Project | null;
  onSelect: (project: Project) => void;
  onCancel: () => void;
}

export function ProjectSelector({ projects, activeProject, onSelect, onCancel }: Props) {
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
          DESCRIPTION
        </Text>
      </Box>

      {projects.length === 0 ? (
        <Box paddingX={1} paddingY={1}>
          <Text color={theme.fg}>
            No projects. Create via: task project create -n &quot;name&quot;
          </Text>
        </Box>
      ) : (
        projects.map((project, i) => {
          const isSelected = i === selectedIndex;
          const isActive = project.id === activeProject?.id;
          const marker = isActive ? '*' : ' ';

          if (isSelected) {
            return (
              <Box key={project.id} paddingX={1}>
                <Text backgroundColor={theme.table.cursorBg} color={theme.table.cursorFg} bold>
                  {marker} {project.name.padEnd(28)}
                  {project.description}
                </Text>
              </Box>
            );
          }

          return (
            <Box key={project.id} paddingX={1}>
              <Text color={isActive ? theme.status.modified : theme.table.fg}>
                {marker} {project.name.padEnd(28)}
              </Text>
              <Text dimColor>{project.description}</Text>
            </Box>
          );
        })
      )}

      <Box flexGrow={1} />
    </Box>
  );
}
