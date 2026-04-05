import { useMemo } from 'react';
import { Box, Text, useStdout } from 'ink';
import chalk from 'chalk';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { renderMarkdown, MermaidHint } from './Markdown.js';

interface Props {
  task: Task;
  blockers?: Task[];
  dependents?: Task[];
  related?: Task[];
  duplicates?: Task[];
  isFocused?: boolean;
  scrollOffset?: number;
}

const PAD = ' ';

function field(label: string, value: string): string {
  return (
    PAD +
    chalk.hex(theme.yaml.key).bold(label) +
    chalk.hex(theme.yaml.colon)(': ') +
    chalk.hex(theme.yaml.value)(value)
  );
}

function sectionHeader(title: string): string {
  return PAD + chalk.hex(theme.title).bold(`--- ${title} ---`);
}

function markdownLines(content: string): string[] {
  const rendered = renderMarkdown(content);
  if (!rendered) return [];
  return rendered.split('\n').map((line) => PAD + line);
}

/** Build the full detail content as an array of pre-formatted text lines. */
function buildContentLines(
  task: Task,
  blockers: Task[],
  dependents: Task[],
  related: Task[],
  duplicates: Task[],
): string[] {
  const lines: string[] = [];

  // Metadata
  lines.push(field('id', task.id));
  lines.push(field('type', task.type));
  lines.push(field('status', task.status));
  lines.push(field('created', new Date(task.createdAt).toLocaleString()));
  lines.push(field('updated', new Date(task.updatedAt).toLocaleString()));
  if (task.parentId) lines.push(field('parent', task.parentId));

  // Dependencies
  const hasDeps =
    blockers.length > 0 || dependents.length > 0 || related.length > 0 || duplicates.length > 0;
  if (hasDeps) {
    lines.push(sectionHeader('dependencies'));
    if (blockers.length > 0) {
      lines.push(
        PAD +
          chalk.hex(theme.status.error).bold('blocked by: ') +
          chalk.hex(theme.yaml.value)(blockers.map((t) => t.id).join(', ')),
      );
    }
    if (dependents.length > 0) {
      lines.push(
        PAD +
          chalk.hex(theme.status.added).bold('blocks: ') +
          chalk.hex(theme.yaml.value)(dependents.map((t) => t.id).join(', ')),
      );
    }
    if (related.length > 0) {
      lines.push(
        PAD +
          chalk.hex(theme.status.new).bold('relates to: ') +
          chalk.hex(theme.yaml.value)(related.map((t) => t.id).join(', ')),
      );
    }
    if (duplicates.length > 0) {
      lines.push(
        PAD +
          chalk.hex(theme.status.pending).bold('duplicates: ') +
          chalk.hex(theme.yaml.value)(duplicates.map((t) => t.id).join(', ')),
      );
    }
    lines.push(PAD + chalk.dim('press D to manage dependencies'));
  }

  // Description
  lines.push(sectionHeader('description'));
  if (task.description.trim()) {
    lines.push(...markdownLines(task.description));
  } else {
    lines.push(PAD + chalk.dim('No description'));
  }

  // Technical Notes
  if (task.technicalNotes.trim()) {
    lines.push(sectionHeader('technical notes'));
    lines.push(...markdownLines(task.technicalNotes));
  }

  // Additional Requirements
  if (task.additionalRequirements.trim()) {
    lines.push(sectionHeader('requirements'));
    lines.push(...markdownLines(task.additionalRequirements));
  }

  return lines;
}

/** Lines reserved outside the scrollable area (header, crumbs, borders, title, mermaid). */
const CHROME_LINES = 8;

export function TaskDetail({
  task,
  blockers = [],
  dependents = [],
  related = [],
  duplicates = [],
  isFocused = true,
  scrollOffset = 0,
}: Props) {
  const { stdout } = useStdout();
  const allText = `${task.description}\n${task.technicalNotes}\n${task.additionalRequirements}`;

  const contentLines = useMemo(
    () => buildContentLines(task, blockers, dependents, related, duplicates),
    [task, blockers, dependents, related, duplicates],
  );

  const viewportHeight = Math.max(1, (stdout.rows > 0 ? stdout.rows : 24) - CHROME_LINES);
  const visibleLines = contentLines.slice(scrollOffset, scrollOffset + viewportHeight);

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="bold"
      borderColor={isFocused ? theme.borderFocus : theme.border}
    >
      {/* Title bar */}
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          detail
        </Text>
        <Text color={theme.fg}>(</Text>
        <Text color={theme.titleHighlight} bold>
          {task.name}
        </Text>
        <Text color={theme.fg}>)</Text>
        {scrollOffset > 0 && <Text dimColor> ↑{scrollOffset}</Text>}
      </Box>

      {/* Scrollable content - pre-rendered text lines */}
      <Text>{visibleLines.join('\n')}</Text>

      <Box flexGrow={1} />

      {/* Mermaid diagram hint */}
      <Box paddingX={1}>
        <MermaidHint content={allText} />
      </Box>
    </Box>
  );
}
