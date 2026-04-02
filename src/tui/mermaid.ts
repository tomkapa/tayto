import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exec } from 'node:child_process';

export function openMermaidInBrowser(code: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'task-mermaid-'));
  const filepath = join(dir, 'diagram.html');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Mermaid Diagram</title>
<style>
  body { background: #1a1a2e; display: flex; justify-content: center; padding: 2rem; }
  .mermaid { background: #16213e; padding: 2rem; border-radius: 8px; }
</style>
</head><body>
<pre class="mermaid">
${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
</pre>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true, theme: 'dark' });
</script>
</body></html>`;

  writeFileSync(filepath, html, 'utf-8');

  // Open in default browser (cross-platform)
  const cmd =
    process.platform === 'darwin'
      ? `open "${filepath}"`
      : process.platform === 'win32'
        ? `start "" "${filepath}"`
        : `xdg-open "${filepath}"`;

  exec(cmd);
}
