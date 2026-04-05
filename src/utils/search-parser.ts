export type ParsedSearch = { kind: 'fts'; query: string } | { kind: 'id'; value: string };

const ID_PREFIX_RE = /^id:(.+)$/;

export function parseSearchQuery(raw: string): ParsedSearch {
  const trimmed = raw.trim();
  const match = ID_PREFIX_RE.exec(trimmed);
  if (match?.[1]) {
    return { kind: 'id', value: match[1] };
  }
  return { kind: 'fts', query: trimmed };
}
