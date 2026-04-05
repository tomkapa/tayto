import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../../src/utils/search-parser.js';

describe('parseSearchQuery', () => {
  it('returns fts kind for plain text', () => {
    expect(parseSearchQuery('login bug')).toEqual({ kind: 'fts', query: 'login bug' });
  });

  it('trims whitespace for fts queries', () => {
    expect(parseSearchQuery('  hello  ')).toEqual({ kind: 'fts', query: 'hello' });
  });

  it('returns id kind for id: prefix', () => {
    expect(parseSearchQuery('id:CODE-1')).toEqual({ kind: 'id', value: 'CODE-1' });
  });

  it('preserves case in id value', () => {
    expect(parseSearchQuery('id:Proj-42')).toEqual({ kind: 'id', value: 'Proj-42' });
  });

  it('trims whitespace around id: prefix', () => {
    expect(parseSearchQuery('  id:CODE-1  ')).toEqual({ kind: 'id', value: 'CODE-1' });
  });

  it('treats id: without value as fts (no match)', () => {
    expect(parseSearchQuery('id:')).toEqual({ kind: 'fts', query: 'id:' });
  });

  it('treats text containing id: mid-string as fts', () => {
    expect(parseSearchQuery('find id:CODE')).toEqual({ kind: 'fts', query: 'find id:CODE' });
  });

  it('handles CODE-1 as fts (all-field search)', () => {
    expect(parseSearchQuery('CODE-1')).toEqual({ kind: 'fts', query: 'CODE-1' });
  });
});
