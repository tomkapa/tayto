import { ulid } from 'ulid';

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

/**
 * Value object representing an anonymous installation identifier.
 * Generated once per install, stored locally, and used for telemetry deduplication.
 */
export class InstallId {
  readonly value: string;

  private constructor(id: string) {
    this.value = id;
  }

  static generate(): InstallId {
    return new InstallId(ulid());
  }

  static parse(raw: string): InstallId {
    const trimmed = raw.trim();
    if (!ULID_REGEX.test(trimmed)) {
      throw new Error(`Invalid InstallId: expected ULID format, got "${trimmed}"`);
    }
    return new InstallId(trimmed.toUpperCase());
  }

  toString(): string {
    return this.value;
  }
}
