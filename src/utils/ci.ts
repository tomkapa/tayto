const CI_ENV_VARS = [
  'CI',
  'GITHUB_ACTIONS',
  'JENKINS_URL',
  'GITLAB_CI',
  'CIRCLECI',
  'BUILDKITE',
  'TF_BUILD',
  'CODEBUILD_BUILD_ID',
] as const;

/**
 * Detects whether the current process is running in a CI environment
 * by checking common CI provider environment variables.
 */
export function isCI(env: Record<string, string | undefined> = process.env): boolean {
  return CI_ENV_VARS.some((key) => {
    const val = env[key];
    return val !== undefined && val !== '';
  });
}
