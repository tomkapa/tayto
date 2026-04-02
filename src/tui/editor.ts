import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

function getEditor(): string {
  return process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi';
}

export function openInEditor(content: string, filename: string): string | null {
  const dir = mkdtempSync(join(tmpdir(), 'task-'));
  const filepath = join(dir, filename);

  writeFileSync(filepath, content, 'utf-8');

  const editor = getEditor();
  const result = spawnSync(editor, [filepath], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    try {
      unlinkSync(filepath);
    } catch {
      // ignore cleanup errors
    }
    return null;
  }

  try {
    const edited = readFileSync(filepath, 'utf-8');
    unlinkSync(filepath);
    return edited;
  } catch {
    return null;
  }
}
