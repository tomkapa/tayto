import { describe, it, expect } from 'vitest';
import { InstallId } from '../../src/types/install-id.js';

describe('InstallId', () => {
  describe('generate', () => {
    it('produces a valid ULID string', () => {
      const id = InstallId.generate();
      expect(id.value).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('produces unique IDs on consecutive calls', () => {
      const a = InstallId.generate();
      const b = InstallId.generate();
      expect(a.value).not.toBe(b.value);
    });
  });

  describe('parse', () => {
    it('accepts a valid ULID', () => {
      const raw = InstallId.generate().value;
      const parsed = InstallId.parse(raw);
      expect(parsed.value).toBe(raw);
    });

    it('uppercases the input', () => {
      const raw = InstallId.generate().value.toLowerCase();
      const parsed = InstallId.parse(raw);
      expect(parsed.value).toBe(raw.toUpperCase());
    });

    it('trims whitespace', () => {
      const raw = InstallId.generate().value;
      const parsed = InstallId.parse(`  ${raw}  `);
      expect(parsed.value).toBe(raw);
    });

    it('throws on empty string', () => {
      expect(() => InstallId.parse('')).toThrow('Invalid InstallId');
    });

    it('throws on non-ULID string', () => {
      expect(() => InstallId.parse('not-a-ulid')).toThrow('Invalid InstallId');
    });

    it('throws on too-short string', () => {
      expect(() => InstallId.parse('ABC123')).toThrow('Invalid InstallId');
    });
  });

  describe('toString', () => {
    it('returns the ULID value', () => {
      const id = InstallId.generate();
      expect(id.toString()).toBe(id.value);
      expect(`${id}`).toBe(id.value);
    });
  });

  describe('round-trip', () => {
    it('generate then parse produces equal value', () => {
      const original = InstallId.generate();
      const parsed = InstallId.parse(original.toString());
      expect(parsed.value).toBe(original.value);
    });
  });
});
