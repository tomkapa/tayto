import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Project } from '../../types/project.js';
import { theme } from '../theme.js';

interface Props {
  editingProject?: Project | null;
  onSave: (data: {
    name: string;
    key: string;
    description: string;
    isDefault: boolean;
    gitRemote: string;
  }) => void;
  onCancel: () => void;
}

type FieldKey = 'name' | 'key' | 'description' | 'gitRemote' | 'isDefault';

interface Field {
  label: string;
  key: FieldKey;
  type: 'inline' | 'toggle';
}

const FIELDS: Field[] = [
  { label: 'Name', key: 'name', type: 'inline' },
  { label: 'Key', key: 'key', type: 'inline' },
  { label: 'Description', key: 'description', type: 'inline' },
  { label: 'Git Remote', key: 'gitRemote', type: 'inline' },
  { label: 'Default', key: 'isDefault', type: 'toggle' },
];

export function ProjectForm({ editingProject, onSave, onCancel }: Props) {
  const isEditing = !!editingProject;
  const [focusIndex, setFocusIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (editingProject) {
      return {
        name: editingProject.name,
        key: editingProject.key,
        description: editingProject.description,
        gitRemote: editingProject.gitRemote ?? '',
        isDefault: editingProject.isDefault ? 'yes' : 'no',
      };
    }
    return {
      name: '',
      key: '',
      description: '',
      gitRemote: '',
      isDefault: 'no',
    };
  });
  const [cursorPos, setCursorPos] = useState(0);
  const cursorRef = useRef(cursorPos);
  cursorRef.current = cursorPos;

  useEffect(() => {
    const field = FIELDS[focusIndex];
    if (field?.type === 'inline') {
      const pos = values[field.key]?.length ?? 0;
      setCursorPos(pos);
      cursorRef.current = pos;
    }
  }, [focusIndex]);

  const currentField = FIELDS[focusIndex];

  useInput((input, key) => {
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
          key: values['key'] ?? '',
          description: values['description'] ?? '',
          gitRemote: values['gitRemote'] ?? '',
          isDefault: values['isDefault'] === 'yes',
        });
      }
      return;
    }

    if (key.upArrow) {
      setFocusIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setFocusIndex((i) => Math.min(FIELDS.length - 1, i + 1));
      return;
    }

    // Key is immutable when editing
    const isReadOnly = isEditing && currentField.key === 'key';

    if (currentField.type === 'inline' && !isReadOnly) {
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

    if (currentField.type === 'toggle') {
      if (key.return || key.rightArrow || key.leftArrow || input === ' ') {
        setValues((v) => ({
          ...v,
          [currentField.key]: v[currentField.key] === 'yes' ? 'no' : 'yes',
        }));
      }
    }
  });

  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="bold" borderColor={theme.borderFocus}>
      <Box gap={0}>
        <Text color={theme.title} bold>
          {' '}
          {isEditing ? 'edit project' : 'new project'}
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {FIELDS.map((field, i) => {
          const isFocused = i === focusIndex;
          const value = values[field.key] ?? '';

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
                  {field.key === 'key' && !value && !isEditing && (
                    <Text dimColor>{isFocused ? ' (auto from name)' : ''}</Text>
                  )}
                  {field.key === 'key' && isEditing && isFocused && (
                    <Text dimColor> (read-only)</Text>
                  )}
                </Text>
              )}

              {field.type === 'toggle' && (
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
    </Box>
  );
}
