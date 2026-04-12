import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import { TaskStatus, TaskType } from '../../types/enums.js';
import type { Task } from '../../types/task.js';
import type { DependencyEntry } from '../../types/task.js';
import { theme } from '../theme.js';
import { STATUS_VALUES, TYPE_VALUES, DEP_TYPE_LABEL } from '../constants.js';
import { openInEditor } from '../editor.js';
import { TaskPicker } from './TaskPicker.js';
import type { PickedDependency } from './TaskPicker.js';

interface Props {
  editingTask: Task | null;
  /** All project tasks, used by the dependency picker */
  allTasks: Task[];
  /** Pre-populated dependencies when editing an existing task */
  initialDeps?: PickedDependency[];
  onSave: (data: {
    name: string;
    description: string;
    type: string;
    status: string;
    technicalNotes: string;
    additionalRequirements: string;
    dependsOn?: DependencyEntry[];
  }) => void;
  onCancel: () => void;
}

type FieldType = 'inline' | 'select' | 'editor' | 'picker';

interface Field {
  label: string;
  key: string;
  type: FieldType;
  options?: string[];
  editorFilename?: string;
}

const FIELDS: Field[] = [
  { label: 'Name', key: 'name', type: 'inline' },
  { label: 'Type', key: 'type', type: 'select', options: TYPE_VALUES },
  { label: 'Status', key: 'status', type: 'select', options: STATUS_VALUES },
  { label: 'Depends On', key: 'dependsOn', type: 'picker' },
  { label: 'Description', key: 'description', type: 'editor', editorFilename: 'description.md' },
  {
    label: 'Tech Notes',
    key: 'technicalNotes',
    type: 'editor',
    editorFilename: 'technical-notes.md',
  },
  {
    label: 'Requirements',
    key: 'additionalRequirements',
    type: 'editor',
    editorFilename: 'requirements.md',
  },
];

export function TaskForm({ editingTask, allTasks, initialDeps, onSave, onCancel }: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({
    name: editingTask?.name ?? '',
    type: editingTask?.type ?? TaskType.Story,
    status: editingTask?.status ?? TaskStatus.Backlog,
    description: editingTask?.description ?? '',
    technicalNotes: editingTask?.technicalNotes ?? '',
    additionalRequirements: editingTask?.additionalRequirements ?? '',
  });
  const [cursorPos, setCursorPos] = useState(() => (editingTask?.name ?? '').length);
  const cursorRef = useRef(cursorPos);
  cursorRef.current = cursorPos;
  const [editorActive, setEditorActive] = useState(false);
  const [pickerActive, setPickerActive] = useState(false);
  const [pickedDeps, setPickedDeps] = useState(initialDeps ?? []);
  const { setRawMode } = useStdin();

  useEffect(() => {
    const field = FIELDS[focusIndex];
    if (field?.type === 'inline') {
      const pos = values[field.key]?.length ?? 0;
      setCursorPos(pos);
      cursorRef.current = pos;
    }
  }, [focusIndex]);

  const currentField = FIELDS[focusIndex];

  const launchEditor = useCallback(
    (field: Field) => {
      setEditorActive(true);
      setTimeout(() => {
        const content = values[field.key] ?? '';
        const result = openInEditor(content, field.editorFilename ?? `${field.key}.md`, {
          beforeOpen: () => {
            setRawMode(false);
          },
          afterOpen: () => {
            setRawMode(true);
          },
        });
        if (result !== null) {
          setValues((v) => ({ ...v, [field.key]: result }));
        }
        setEditorActive(false);
      }, 50);
    },
    [values, setRawMode],
  );

  const handlePickerConfirm = useCallback((selected: PickedDependency[]) => {
    setPickedDeps(selected);
    setPickerActive(false);
  }, []);

  const handlePickerCancel = useCallback(() => {
    setPickerActive(false);
  }, []);

  useInput(
    (input, key) => {
      if (editorActive || pickerActive) return;

      if (key.escape) {
        onCancel();
        return;
      }

      if (!currentField) return;

      if (key.tab) {
        if (key.shift) {
          setFocusIndex((i) => Math.max(0, i - 1));
        } else {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        }
        return;
      }

      if (input === 's' && key.ctrl) {
        const nameVal = values['name'];
        if (typeof nameVal === 'string' && nameVal.trim()) {
          onSave({
            name: nameVal,
            description: values['description'] ?? '',
            type: values['type'] ?? TaskType.Story,
            status: values['status'] ?? TaskStatus.Backlog,
            technicalNotes: values['technicalNotes'] ?? '',
            additionalRequirements: values['additionalRequirements'] ?? '',
            dependsOn: pickedDeps.map((d) => ({ id: d.id, type: d.type })),
          });
        }
        return;
      }

      // Up/down arrows navigate fields for all field types
      if (key.upArrow) {
        setFocusIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        return;
      }

      if (currentField.type === 'inline') {
        if (key.leftArrow) {
          setCursorPos((p) => Math.max(0, p - 1));
        } else if (key.rightArrow) {
          setCursorPos((p) => Math.min((values[currentField.key] ?? '').length, p + 1));
        } else if (key.backspace || key.delete) {
          const pos = cursorRef.current;
          if (pos > 0) {
            setValues((v) => {
              const cur = v[currentField.key] ?? '';
              return { ...v, [currentField.key]: cur.slice(0, pos - 1) + cur.slice(pos) };
            });
            cursorRef.current = pos - 1;
            setCursorPos(pos - 1);
          }
        } else if (key.return) {
          setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
        } else if (input && !key.ctrl && !key.meta) {
          const pos = cursorRef.current;
          setValues((v) => {
            const cur = v[currentField.key] ?? '';
            return { ...v, [currentField.key]: cur.slice(0, pos) + input + cur.slice(pos) };
          });
          cursorRef.current = pos + input.length;
          setCursorPos(pos + input.length);
        }
      }

      if (currentField.type === 'picker') {
        if (key.return) {
          setPickerActive(true);
        }
      }

      if (currentField.type === 'editor') {
        if (key.return) {
          launchEditor(currentField);
        }
      }

      if (currentField.type === 'select') {
        const options = currentField.options ?? [];
        const currentValue = values[currentField.key] ?? '';
        const currentIndex = options.indexOf(currentValue);
        if (key.rightArrow || key.return || input === ' ') {
          const nextIndex = (currentIndex + 1) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[nextIndex] ?? '' }));
        } else if (key.leftArrow) {
          const prevIndex = (currentIndex - 1 + options.length) % options.length;
          setValues((v) => ({ ...v, [currentField.key]: options[prevIndex] ?? '' }));
        }
      }
    },
    { isActive: !editorActive && !pickerActive },
  );

  // When picker is open, render it instead of the form
  if (pickerActive) {
    const pickerExclude: { excludeIds?: Set<string> } = editingTask
      ? { excludeIds: new Set([editingTask.id]) }
      : {};
    return (
      <TaskPicker
        tasks={allTasks}
        {...pickerExclude}
        initialSelection={pickedDeps}
        onConfirm={handlePickerConfirm}
        onCancel={handlePickerCancel}
      />
    );
  }

  const isEdit = editingTask !== null;

  // Build dependency display summary
  const depSummary =
    pickedDeps.length > 0
      ? pickedDeps.map((d) => `${d.id} (${DEP_TYPE_LABEL[d.type] ?? d.type})`).join(', ')
      : '';

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          {isEdit ? 'edit' : 'create'}
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {FIELDS.map((field, i) => {
          const isFocused = i === focusIndex;
          const value = field.key === 'dependsOn' ? depSummary : (values[field.key] ?? '');

          return (
            <Box key={field.key} gap={1}>
              <Text color={isFocused ? theme.dialog.label : theme.yaml.key} bold={isFocused}>
                {isFocused ? '>' : ' '} {field.label.padEnd(14)}
              </Text>

              {field.type === 'inline' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {isFocused ? (
                    <>
                      {value.slice(0, cursorPos)}
                      <Text color={theme.titleHighlight}>_</Text>
                      {value.slice(cursorPos)}
                    </>
                  ) : (
                    value
                  )}
                </Text>
              )}

              {field.type === 'picker' && (
                <Text>
                  {value ? (
                    <Text color={theme.status.added}>
                      {value.length > 60 ? value.slice(0, 60) + '...' : value}
                    </Text>
                  ) : (
                    <Text dimColor>{isFocused ? 'press enter to select' : 'none'}</Text>
                  )}
                  {isFocused && <Text color={theme.menu.key}> [enter: open picker]</Text>}
                </Text>
              )}

              {field.type === 'editor' && (
                <Text>
                  {value ? (
                    <Text color={theme.status.added}>
                      {value.split('\n')[0]?.slice(0, 50)}
                      {value.length > 50 || value.includes('\n') ? '...' : ''}
                    </Text>
                  ) : (
                    <Text dimColor>{isFocused ? 'press enter' : 'empty'}</Text>
                  )}
                  {isFocused && <Text color={theme.menu.key}> [enter: $EDITOR]</Text>}
                </Text>
              )}

              {field.type === 'select' && (
                <Text color={isFocused ? theme.yaml.value : theme.table.fg}>
                  {isFocused ? '< ' : '  '}
                  {value}
                  {isFocused ? ' >' : ''}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box flexGrow={1} />

      <Box paddingX={1}>
        <Text dimColor>{'↑↓/tab: navigate | ←→: cursor | ctrl+s: save | esc: cancel'}</Text>
      </Box>
      {editorActive && (
        <Box paddingX={1}>
          <Text color={theme.flash.warn} bold>
            Editor open... save and close to return
          </Text>
        </Box>
      )}
    </Box>
  );
}
