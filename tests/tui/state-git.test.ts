import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../src/tui/state.js';
import { ViewType } from '../../src/tui/types.js';
import type { Project } from '../../src/types/project.js';
import { GitRemote } from '../../src/types/git-remote.js';

const mockProject: Project = {
  id: 'proj-1',
  key: 'TEST',
  name: 'Test Project',
  description: '',
  isDefault: true,
  gitRemote: GitRemote.parse('git@github.com:org/repo.git'),
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('appReducer detected-git-remote actions', () => {
  it('SET_DETECTED_GIT_REMOTE stores the detected remote', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    const state = appReducer(initialState, { type: 'SET_DETECTED_GIT_REMOTE', remote });
    expect(state.detectedGitRemote).toBe(remote);
  });

  it('SET_DETECTED_GIT_REMOTE clears the remote when null', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    const withRemote = appReducer(initialState, { type: 'SET_DETECTED_GIT_REMOTE', remote });
    const state = appReducer(withRemote, { type: 'SET_DETECTED_GIT_REMOTE', remote: null });
    expect(state.detectedGitRemote).toBeNull();
  });

  it('GO_BACK clears detectedGitRemote', () => {
    const remote = GitRemote.parse('git@github.com:org/repo.git');
    const withRemote = appReducer(initialState, { type: 'SET_DETECTED_GIT_REMOTE', remote });
    const navigated = appReducer(withRemote, {
      type: 'NAVIGATE_TO',
      view: ViewType.ProjectCreate,
    });
    const state = appReducer(navigated, { type: 'GO_BACK' });
    expect(state.detectedGitRemote).toBeNull();
  });

  it('initialState has detectedGitRemote as null', () => {
    expect(initialState.detectedGitRemote).toBeNull();
  });
});

describe('appReducer git-related actions', () => {
  it('SET_LINKING_PROJECT sets the linking project', () => {
    const state = appReducer(initialState, {
      type: 'SET_LINKING_PROJECT',
      project: mockProject,
    });
    expect(state.linkingProject).toBe(mockProject);
  });

  it('SET_LINKING_PROJECT clears the linking project with null', () => {
    const withProject = appReducer(initialState, {
      type: 'SET_LINKING_PROJECT',
      project: mockProject,
    });
    const state = appReducer(withProject, {
      type: 'SET_LINKING_PROJECT',
      project: null,
    });
    expect(state.linkingProject).toBeNull();
  });

  it('NAVIGATE_TO ProjectLink adds to breadcrumbs', () => {
    const state = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.ProjectLink,
    });
    expect(state.activeView).toBe(ViewType.ProjectLink);
    expect(state.breadcrumbs).toContain(ViewType.ProjectLink);
  });

  it('GO_BACK from ProjectLink returns to previous view', () => {
    const navigated = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.ProjectLink,
    });
    const state = appReducer(navigated, { type: 'GO_BACK' });
    expect(state.activeView).toBe(ViewType.TaskList);
  });
});
