import { describe, it, expect } from 'vitest';
import { parseChangelog } from '../../src/utils/changelog-parser.js';

const SAMPLE_CHANGELOG = `# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Some unreleased feature

## [0.7.0] - 2026-04-12

### Added
- Prompt to create project when unlinked git remote is detected on TUI startup
- Project edit support in TUI and \`--git-remote\` flag for CLI

### Changed
- Introduce \`GitRemote\` value object to enforce URL normalization

### Fixed
- Restore terminal raw mode around external editor to prevent readonly mode

## [0.6.0] - 2026-04-12

### Added
- Auto-upgrade with npm registry version check and \`tayto upgrade\` command
- Contextual hints in TUI for discoverability

### Changed
- Improve TUI intuitiveness with better keyboard shortcut guidance

### Chore
- Add open-source project scaffolding

## [0.5.0] - 2026-04-10

### Changed
- Redesign TUI color theme

[Unreleased]: https://github.com/example/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/example/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/example/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/example/releases/tag/v0.5.0
`;

describe('parseChangelog', () => {
  it('skips the Unreleased section', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    expect(entries.every((e) => e.version !== 'Unreleased')).toBe(true);
  });

  it('skips link references at the bottom', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    // None of the entries should have content that looks like link refs
    for (const entry of entries) {
      for (const section of entry.sections) {
        for (const item of section.items) {
          expect(item).not.toMatch(/^\[.*\]: https?:\/\//);
        }
      }
    }
  });

  it('parses version and date correctly', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    expect(entries[0]).toMatchObject({ version: '0.7.0', date: '2026-04-12' });
    expect(entries[1]).toMatchObject({ version: '0.6.0', date: '2026-04-12' });
    expect(entries[2]).toMatchObject({ version: '0.5.0', date: '2026-04-10' });
  });

  it('returns entries sorted newest-first', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    expect(entries.map((e) => e.version)).toEqual(['0.7.0', '0.6.0', '0.5.0']);
  });

  it('parses sections and items', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    const v07 = entries[0];
    expect(v07).toBeDefined();
    if (!v07) return;

    const added = v07.sections.find((s) => s.heading === 'Added');
    expect(added).toBeDefined();
    expect(added?.items).toHaveLength(2);
    expect(added?.items[0]).toBe(
      'Prompt to create project when unlinked git remote is detected on TUI startup',
    );

    const changed = v07.sections.find((s) => s.heading === 'Changed');
    expect(changed?.items).toHaveLength(1);

    const fixed = v07.sections.find((s) => s.heading === 'Fixed');
    expect(fixed?.items).toHaveLength(1);
  });

  it('handles unusual section types like Chore', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG);
    const v06 = entries[1];
    expect(v06).toBeDefined();
    if (!v06) return;
    const chore = v06.sections.find((s) => s.heading === 'Chore');
    expect(chore).toBeDefined();
    expect(chore?.items).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(parseChangelog('')).toEqual([]);
  });

  it('returns empty array for input with only Unreleased', () => {
    const input = `# Changelog\n\n## [Unreleased]\n\n### Added\n- Something\n`;
    expect(parseChangelog(input)).toEqual([]);
  });

  it('handles a single version with no sections', () => {
    const input = `## [1.0.0] - 2026-01-01\n`;
    const entries = parseChangelog(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ version: '1.0.0', date: '2026-01-01', sections: [] });
  });

  it('strips leading dash and whitespace from items', () => {
    const input = `## [1.0.0] - 2026-01-01\n\n### Added\n- First item\n-   Second item with extra spaces\n`;
    const entries = parseChangelog(input);
    const items = entries[0]?.sections[0]?.items ?? [];
    expect(items[0]).toBe('First item');
    expect(items[1]).toBe('Second item with extra spaces');
  });

  it('handles versions without a date', () => {
    const input = `## [0.3.0]\n\n### Added\n- Feature without date\n`;
    const entries = parseChangelog(input);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ version: '0.3.0', date: null });
    expect(entries[0]?.sections[0]?.items).toEqual(['Feature without date']);
  });

  it('treats undated version headers as boundaries, not leaking into previous entry', () => {
    const input = [
      '## [0.4.0] - 2026-04-09',
      '',
      '### Added',
      '- Item from 0.4.0',
      '',
      '## [0.3.0]',
      '',
      '### Added',
      '- Item from 0.3.0',
      '',
      '## [0.2.0]',
      '',
      '### Added',
      '- Item from 0.2.0',
    ].join('\n');

    const entries = parseChangelog(input);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.version)).toEqual(['0.4.0', '0.3.0', '0.2.0']);

    // v0.4.0 should only have its own item, not items from v0.3.0 or v0.2.0
    const v04Added = entries[0]?.sections.find((s) => s.heading === 'Added');
    expect(v04Added?.items).toEqual(['Item from 0.4.0']);

    const v03Added = entries[1]?.sections.find((s) => s.heading === 'Added');
    expect(v03Added?.items).toEqual(['Item from 0.3.0']);
  });
});
