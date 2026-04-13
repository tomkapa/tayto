import type { ChangelogEntry } from './utils/changelog-parser.js';

declare const __CHANGELOG_ENTRIES__: ChangelogEntry[];

export const CHANGELOG_ENTRIES: ChangelogEntry[] =
  typeof __CHANGELOG_ENTRIES__ !== 'undefined' ? __CHANGELOG_ENTRIES__ : [];
