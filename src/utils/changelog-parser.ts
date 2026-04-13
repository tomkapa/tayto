export interface ChangelogEntry {
  version: string;
  date: string | null;
  sections: { heading: string; items: string[] }[];
}

// Date is optional — some older entries omit it (e.g. `## [0.3.0]`).
const VERSION_HEADER = /^## \[(\d+\.\d+\.\d+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?\s*$/;
const SECTION_HEADER = /^### (.+)\s*$/;
const BULLET_ITEM = /^- (.+)$/;
const LINK_REF = /^\[.*\]: https?:\/\//;

/**
 * Parses a CHANGELOG.md string in Keep a Changelog format.
 * Skips the [Unreleased] section and link references at the bottom.
 * Returns entries sorted newest-first (as they appear in the file).
 */
export function parseChangelog(raw: string): ChangelogEntry[] {
  const lines = raw.split('\n');
  const entries: ChangelogEntry[] = [];

  let currentEntry: ChangelogEntry | null = null;
  let currentSection: { heading: string; items: string[] } | null = null;

  for (const line of lines) {
    // Skip link references
    if (LINK_REF.test(line)) continue;

    const versionMatch = VERSION_HEADER.exec(line);
    if (versionMatch) {
      // Finalize previous entry
      if (currentEntry) {
        if (currentSection) {
          currentEntry.sections.push(currentSection);
          currentSection = null;
        }
        entries.push(currentEntry);
      }
      const version = versionMatch[1] ?? '';
      const date = versionMatch[2] ?? null;
      currentEntry = { version, date, sections: [] };
      continue;
    }

    if (!currentEntry) continue;

    const sectionMatch = SECTION_HEADER.exec(line);
    if (sectionMatch) {
      if (currentSection) {
        currentEntry.sections.push(currentSection);
      }
      currentSection = { heading: sectionMatch[1] ?? '', items: [] };
      continue;
    }

    if (currentSection) {
      const bulletMatch = BULLET_ITEM.exec(line);
      if (bulletMatch) {
        currentSection.items.push((bulletMatch[1] ?? '').trim());
      }
    }
  }

  // Finalize last entry
  if (currentEntry) {
    if (currentSection) {
      currentEntry.sections.push(currentSection);
    }
    entries.push(currentEntry);
  }

  return entries;
}
