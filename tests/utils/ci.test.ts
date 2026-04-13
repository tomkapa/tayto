import { describe, it, expect } from 'vitest';
import { isCI } from '../../src/utils/ci.js';

describe('isCI', () => {
  it('returns false when no CI env vars are set', () => {
    expect(isCI({})).toBe(false);
  });

  const ciVars = [
    'CI',
    'GITHUB_ACTIONS',
    'JENKINS_URL',
    'GITLAB_CI',
    'CIRCLECI',
    'BUILDKITE',
    'TF_BUILD',
    'CODEBUILD_BUILD_ID',
  ];

  for (const envVar of ciVars) {
    it(`returns true when ${envVar} is set`, () => {
      expect(isCI({ [envVar]: 'true' })).toBe(true);
    });
  }

  it('returns false when CI env var is empty string', () => {
    expect(isCI({ CI: '' })).toBe(false);
  });

  it('returns true when CI env var is "1"', () => {
    expect(isCI({ CI: '1' })).toBe(true);
  });

  it('returns true when multiple CI env vars are set', () => {
    expect(isCI({ CI: 'true', GITHUB_ACTIONS: 'true' })).toBe(true);
  });

  it('ignores unrelated env vars', () => {
    expect(isCI({ HOME: '/home/user', PATH: '/usr/bin' })).toBe(false);
  });
});
