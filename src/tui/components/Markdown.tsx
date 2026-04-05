import { Text, Box } from 'ink';
import { Marked, type Token, type Tokens } from 'marked';
import { markedTerminal } from 'marked-terminal';
import chalk from 'chalk';
import { theme } from '../theme.js';
import { openMermaidInBrowser } from '../mermaid.js';

/** Extract mermaid code blocks from markdown content using the lexer (pure, no side effects). */
export function extractMermaidBlocks(content: string): string[] {
  const lexer = new Marked();
  const tokens = lexer.lexer(content);
  const blocks: string[] = [];

  function walk(items: Token[]): void {
    for (const token of items) {
      if (token.type === 'code' && (token as Tokens.Code).lang === 'mermaid') {
        blocks.push((token as Tokens.Code).text);
      }
      if ('tokens' in token && Array.isArray(token.tokens)) {
        walk(token.tokens);
      }
    }
  }

  walk(tokens);
  return blocks;
}

function createRenderer(): Marked {
  const mermaidExtension = {
    renderer: {
      code(token: Tokens.Code): string | false {
        if (token.lang !== 'mermaid') return false;

        const lines = token.text.split('\n');
        const preview = lines.slice(0, 6);
        const maxLen = Math.max(...preview.map((l) => l.length), 30);
        const border = '─'.repeat(maxLen + 2);

        const framed = preview
          .map((l) => `  ${chalk.dim('│')} ${chalk.hex(theme.table.fg)(l)}`)
          .join('\n');
        const truncated =
          lines.length > 6
            ? `\n  ${chalk.dim('│')} ${chalk.dim(`... ${lines.length - 6} more lines`)}`
            : '';

        return [
          '',
          `  ${chalk.hex(theme.title).bold('┌ Mermaid Diagram')}  ${chalk.hex(theme.menu.key)('[press m to open in browser]')}`,
          `  ${chalk.dim(border)}`,
          framed,
          truncated,
          `  ${chalk.dim(border)}`,
          '',
        ].join('\n');
      },
    },
  };

  const terminalExt = markedTerminal as unknown as (
    opts: Record<string, unknown>,
  ) => Parameters<Marked['use']>[0];

  return new Marked(
    terminalExt({
      showSectionPrefix: false,
      reflowText: true,
      tab: 2,
    }),
    mermaidExtension,
  );
}

const marked = createRenderer();

/** Render markdown to an ANSI-styled string (for pre-formatted text output). */
export function renderMarkdown(content: string): string {
  if (!content.trim()) return '';
  const rendered = marked.parse(content);
  return typeof rendered === 'string' ? rendered.trimEnd() : content;
}

interface Props {
  content: string;
}

export function Markdown({ content }: Props) {
  if (!content.trim()) {
    return <Text dimColor>No content</Text>;
  }

  const rendered = marked.parse(content);
  if (typeof rendered !== 'string') {
    return <Text>{content}</Text>;
  }

  return <Text>{rendered.trimEnd()}</Text>;
}

interface MermaidProps {
  content: string;
}

export function MermaidHint({ content }: MermaidProps) {
  const blocks = extractMermaidBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <Box>
      <Text color={theme.menu.key} bold>
        {'<m>'}{' '}
      </Text>
      <Text dimColor>
        Open {blocks.length} mermaid diagram{blocks.length > 1 ? 's' : ''} in browser
      </Text>
    </Box>
  );
}

export function openAllMermaidDiagrams(content: string): number {
  const blocks = extractMermaidBlocks(content);
  for (const block of blocks) {
    openMermaidInBrowser(block);
  }
  return blocks.length;
}
