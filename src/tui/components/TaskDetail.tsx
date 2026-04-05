import { Box, Text, useStdout } from 'ink';
import type { Task } from '../../types/task.js';
import { theme } from '../theme.js';
import { Markdown, MermaidHint } from './Markdown.js';

interface Props {
  task: Task;
  blockers?: Task[];
  dependents?: Task[];
  related?: Task[];
  duplicates?: Task[];
  isFocused?: boolean;
  scrollOffset?: number;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box gap={0}>
      <Text color={theme.yaml.key} bold>
        {label}
      </Text>
      <Text color={theme.yaml.colon}>: </Text>
      <Text color={theme.yaml.value}>{value}</Text>
    </Box>
  );
}

export function TaskDetail({
  task,
  blockers,
  dependents,
  related,
  duplicates,
  isFocused = true,
  scrollOffset = 0,
}: Props) {
  const { stdout } = useStdout();
  const allText = `${task.description}\n${task.technicalNotes}\n${task.additionalRequirements}`;

  // Reserve 4 lines for title bar + footer + border
  const viewportHeight = Math.max(5, (stdout.rows > 0 ? stdout.rows : 24) - 4);

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

      {/* Scrollable content area */}
      <Box flexDirection="column" height={viewportHeight} overflowY="hidden">
        <Box flexDirection="column" marginTop={-scrollOffset}>
          {/* Metadata in YAML style */}
          <Box flexDirection="column" paddingX={1} paddingY={0}>
            <Field label="id" value={task.id} />
            <Field label="type" value={task.type} />
            <Field label="status" value={task.status} />
            <Field label="created" value={new Date(task.createdAt).toLocaleString()} />
            <Field label="updated" value={new Date(task.updatedAt).toLocaleString()} />
            {task.parentId && <Field label="parent" value={task.parentId} />}
          </Box>

          {/* Dependencies summary */}
          {((blockers && blockers.length > 0) ||
            (dependents && dependents.length > 0) ||
            (related && related.length > 0) ||
            (duplicates && duplicates.length > 0)) && (
            <Box flexDirection="column" paddingX={1}>
              <Text color={theme.title} bold>
                --- dependencies ---
              </Text>
              {blockers && blockers.length > 0 && (
                <Box gap={0}>
                  <Text color={theme.status.error} bold>
                    blocked by:{' '}
                  </Text>
                  <Text color={theme.yaml.value}>{blockers.map((t) => t.id).join(', ')}</Text>
                </Box>
              )}
              {dependents && dependents.length > 0 && (
                <Box gap={0}>
                  <Text color={theme.status.added} bold>
                    blocks:{' '}
                  </Text>
                  <Text color={theme.yaml.value}>{dependents.map((t) => t.id).join(', ')}</Text>
                </Box>
              )}
              {related && related.length > 0 && (
                <Box gap={0}>
                  <Text color={theme.status.new} bold>
                    relates to:{' '}
                  </Text>
                  <Text color={theme.yaml.value}>{related.map((t) => t.id).join(', ')}</Text>
                </Box>
              )}
              {duplicates && duplicates.length > 0 && (
                <Box gap={0}>
                  <Text color={theme.status.pending} bold>
                    duplicates:{' '}
                  </Text>
                  <Text color={theme.yaml.value}>{duplicates.map((t) => t.id).join(', ')}</Text>
                </Box>
              )}
              <Text dimColor>press D to manage dependencies</Text>
            </Box>
          )}

          {/* Description */}
          <Box flexDirection="column" paddingX={1}>
            <Text color={theme.title} bold>
              --- description ---
            </Text>
            {task.description.trim() ? (
              <Markdown content={task.description} />
            ) : (
              <Text dimColor>No description</Text>
            )}
          </Box>

          {/* Technical Notes */}
          {task.technicalNotes.trim() && (
            <Box flexDirection="column" paddingX={1}>
              <Text color={theme.title} bold>
                --- technical notes ---
              </Text>
              <Markdown content={task.technicalNotes} />
            </Box>
          )}

          {/* Additional Requirements */}
          {task.additionalRequirements.trim() && (
            <Box flexDirection="column" paddingX={1}>
              <Text color={theme.title} bold>
                --- requirements ---
              </Text>
              <Markdown content={task.additionalRequirements} />
            </Box>
          )}
        </Box>
      </Box>

      <Box flexGrow={1} />

      {/* Mermaid diagram hint */}
      <Box paddingX={1}>
        <MermaidHint content={allText} />
      </Box>
    </Box>
  );
}
