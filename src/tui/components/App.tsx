import { useReducer, useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import type { Container } from '../../cli/container.js';
import {
  TaskStatus,
  TaskType,
  TaskLevel,
  DependencyType,
  isTerminalStatus,
} from '../../types/enums.js';
import type { Task, DependencyEntry } from '../../types/task.js';
import type { Project } from '../../types/project.js';
import { ViewType, TopTab } from '../types.js';
import { appReducer, initialState } from '../state.js';
import { STATUS_VALUES, TYPE_VALUES } from '../constants.js';
import { Header } from './Header.js';
import { Crumbs } from './Crumbs.js';
import { FlashMessage } from './FlashMessage.js';
import { TaskList } from './TaskList.js';
import { TaskDetail } from './TaskDetail.js';
import { TaskForm } from './TaskForm.js';
import { ProjectSelector } from './ProjectSelector.js';
import { ProjectForm } from './ProjectForm.js';
import { ProjectLinkForm } from './ProjectLinkForm.js';
import { detectGitRemote } from '../../utils/git.js';
import { isDismissedRemote, dismissRemote } from '../../utils/dismissed-remotes.js';
import { HelpOverlay } from './HelpOverlay.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { DetectedProjectDialog } from './DetectedProjectDialog.js';
import { DependencyList } from './DependencyList.js';
import { EpicPanel } from './EpicPanel.js';
import { EpicPicker } from './EpicPicker.js';
import { openAllMermaidDiagrams } from './Markdown.js';
import { ChangelogBanner } from './ChangelogBanner.js';
import { TabBar } from './TabBar.js';
import { SettingsView } from './SettingsView.js';
import { theme } from '../theme.js';
import { logger } from '../../logging/logger.js';
import { useAutoRefetch } from '../useAutoRefetch.js';
import { CHANGELOG_ENTRIES } from '../../changelog.js';
import { readSeenVersion, writeSeenVersion } from '../../utils/changelog-seen.js';
import { APP_VERSION } from '../../version.js';
import { isNewerVersion } from '../../utils/version.js';

interface Props {
  container: Container;
  initialProject?: string | undefined;
  latestVersion?: string | undefined;
}

const STATUS_CYCLE: TaskStatus[] = [
  TaskStatus.Backlog,
  TaskStatus.Todo,
  TaskStatus.InProgress,
  TaskStatus.Review,
  TaskStatus.Done,
];

const EPIC_PANEL_WIDTH = 48;

export function App({ container, initialProject, latestVersion }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Force re-render on terminal resize so layout recalculates
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const onResize = () => {
      setResizeTick((n) => n + 1);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  // Fixed panel widths so they don't jump when content changes
  const termWidth = stdout.columns > 0 ? stdout.columns : 120;
  // EpicPanel border adds 2 chars; remaining space split 60/40 between list/detail
  const remaining = Math.max(0, termWidth - EPIC_PANEL_WIDTH - 2);
  const taskListWidth = Math.floor(remaining * 0.6);
  const taskDetailWidth = remaining - taskListWidth;

  const loadProjects = useCallback(() => {
    const result = container.projectService.listProjects();
    if (result.ok) {
      logger.info(`TUI.loadProjects: loaded ${result.value.length} projects`);
      dispatch({ type: 'SET_PROJECTS', projects: result.value });
    } else {
      logger.error('TUI.loadProjects: failed', result.error);
      dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
    }
  }, [container]);

  const loadTasks = useCallback(() => {
    const activeProject = state.activeProject;
    if (!activeProject) return;
    logger.startSpan('TUI.loadTasks', () => {
      const filter = { ...state.filter, level: TaskLevel.Work };
      // Apply epic filter: when epics are selected, show only their children
      if (state.selectedEpicIds.size > 0) {
        filter.parentIds = [...state.selectedEpicIds];
      }
      const result = container.taskService.listTasks(activeProject, filter);
      if (result.ok) {
        logger.info(`TUI.loadTasks: loaded ${result.value.length} tasks`);
        dispatch({ type: 'SET_TASKS', tasks: result.value });
      } else {
        logger.error('TUI.loadTasks: failed', result.error);
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    });
  }, [container, state.filter, state.activeProject, state.selectedEpicIds]);

  const loadEpics = useCallback(() => {
    if (!state.activeProject) return;
    const result = container.taskService.listTasks(state.activeProject, {
      level: TaskLevel.Epic,
    });
    if (result.ok) {
      dispatch({ type: 'SET_EPICS', epics: result.value });
    } else {
      logger.error('TUI.loadEpics: failed', result.error);
    }
  }, [container, state.activeProject]);

  const loadDeps = useCallback(
    (taskId: string) => {
      const blockersResult = container.dependencyService.listBlockers(taskId);
      const dependentsResult = container.dependencyService.listDependents(taskId);
      const relatedResult = container.dependencyService.listRelated(taskId);
      const duplicatesResult = container.dependencyService.listDuplicates(taskId);
      dispatch({
        type: 'SET_DEPS',
        blockers: blockersResult.ok ? blockersResult.value : [],
        dependents: dependentsResult.ok ? dependentsResult.value : [],
        related: relatedResult.ok ? relatedResult.value : [],
        duplicates: duplicatesResult.ok ? duplicatesResult.value : [],
      });
    },
    [container],
  );

  const cycleStatus = useCallback(
    (task: Task) => {
      const currentIndex = STATUS_CYCLE.indexOf(task.status);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      if (!nextStatus) return;

      const result = container.taskService.updateTask(task.id, { status: nextStatus });
      if (result.ok) {
        dispatch({ type: 'FLASH', message: `Status -> ${nextStatus}`, level: 'info' });
        if (state.selectedTask?.id === task.id) {
          dispatch({ type: 'SELECT_TASK', task: result.value });
        }
        loadTasks();
        loadEpics();
      } else {
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    },
    [container, state.selectedTask, loadTasks, loadEpics],
  );

  const saveReorder = useCallback(() => {
    const activeProject = state.activeProject;
    if (!activeProject) return;
    const tasks = state.tasks;
    const idx = state.selectedIndex;
    const task = tasks[idx];
    if (!task) return;

    const prev = tasks[idx - 1];
    const next = tasks[idx + 1];

    // Use after/before positioning so the service computes the rank
    const result = prev
      ? container.taskService.rerankTask({ taskId: task.id, afterId: prev.id }, activeProject)
      : next
        ? container.taskService.rerankTask({ taskId: task.id, beforeId: next.id }, activeProject)
        : container.taskService.rerankTask({ taskId: task.id, position: 1 }, activeProject);

    dispatch({ type: 'EXIT_REORDER', save: result.ok });
    dispatch({
      type: 'FLASH',
      message: result.ok ? 'Rank saved' : result.error.message,
      level: result.ok ? 'info' : 'error',
    });
    loadTasks();
  }, [container, state.tasks, state.selectedIndex, loadTasks]);

  const saveEpicReorder = useCallback(() => {
    const activeProject = state.activeProject;
    if (!activeProject) return;
    const epics = state.epics;
    const idx = state.epicSelectedIndex;
    const epic = epics[idx];
    if (!epic) return;

    const prev = epics[idx - 1];
    const next = epics[idx + 1];

    const result = prev
      ? container.taskService.rerankTask({ taskId: epic.id, afterId: prev.id }, activeProject)
      : next
        ? container.taskService.rerankTask({ taskId: epic.id, beforeId: next.id }, activeProject)
        : container.taskService.rerankTask({ taskId: epic.id, position: 1 }, activeProject);

    dispatch({ type: 'EXIT_EPIC_REORDER', save: result.ok });
    dispatch({
      type: 'FLASH',
      message: result.ok ? 'Epic rank saved' : result.error.message,
      level: result.ok ? 'info' : 'error',
    });
    loadEpics();
  }, [container, state.epics, state.epicSelectedIndex, loadEpics]);

  const rerankSelectedToEdge = useCallback(
    (kind: 'task' | 'epic', edge: 'top' | 'bottom') => {
      const activeProject = state.activeProject;
      if (!activeProject) return;
      const isEpic = kind === 'epic';
      const item = isEpic ? state.epics[state.epicSelectedIndex] : state.tasks[state.selectedIndex];
      if (!item) return;

      const result = container.taskService.rerankTask(
        {
          taskId: item.id,
          ...(edge === 'top' ? { top: true } : { bottom: true }),
        },
        activeProject,
      );

      dispatch({
        type: isEpic ? 'EXIT_EPIC_REORDER' : 'EXIT_REORDER',
        save: result.ok,
      });
      dispatch({
        type: 'FLASH',
        message: result.ok ? `${isEpic ? 'Epic moved' : 'Moved'} to ${edge}` : result.error.message,
        level: result.ok ? 'info' : 'error',
      });
      if (isEpic) loadEpics();
      else loadTasks();
    },
    [
      container,
      state.tasks,
      state.selectedIndex,
      state.epics,
      state.epicSelectedIndex,
      loadTasks,
      loadEpics,
    ],
  );

  // Watch the SQLite file for external changes (e.g. CLI mutations) and
  // refetch all data so the TUI stays in sync.
  const refetchAll = useCallback(() => {
    loadProjects();
    loadTasks();
    loadEpics();
  }, [loadProjects, loadTasks, loadEpics]);

  useAutoRefetch(container.dbPath, refetchAll);

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Resolve initial project (git-aware: explicit flag → git remote match → default)
  useEffect(() => {
    if (state.projects.length > 0 && !state.activeProject) {
      logger.info(`TUI.resolveProject: resolving initialProject=${initialProject ?? '(default)'}`);
      const result = container.projectService.resolveProject(initialProject);
      if (result.ok) {
        logger.info(
          `TUI.resolveProject: resolved to key=${result.value.key} name=${result.value.name}`,
        );
        dispatch({ type: 'SET_ACTIVE_PROJECT', project: result.value });
      } else {
        logger.error('TUI.resolveProject: failed', result.error);
        const fallback = state.projects[0] ?? null;
        logger.info(`TUI.resolveProject: falling back to ${fallback?.name ?? 'null'}`);
        dispatch({ type: 'SET_ACTIVE_PROJECT', project: fallback });
      }
    }
  }, [state.projects, state.activeProject, initialProject, container]);

  // Detect git remote on first project load; prompt to create project if unlinked.
  // Skip detection when --project flag was explicitly provided (user knows their project).
  const gitRemoteCheckedRef = useRef(false);
  useEffect(() => {
    if (state.projects.length > 0 && !gitRemoteCheckedRef.current && !initialProject) {
      gitRemoteCheckedRef.current = true;
      const remoteResult = detectGitRemote();
      if (remoteResult.ok && remoteResult.value) {
        const remote = remoteResult.value;
        const alreadyLinked = state.projects.some((p) => p.gitRemote?.equals(remote));
        const dismissed = isDismissedRemote(container.dismissedGitRemotesPath, remote);
        if (!alreadyLinked && !dismissed) {
          logger.info(`TUI.detectGitRemote: unlinked remote detected: ${remote.value}`);
          dispatch({ type: 'SET_DETECTED_GIT_REMOTE', remote });
        }
      }
    }
  }, [state.projects, initialProject]);

  // Show changelog banner when the user launches a new version for the first time.
  const changelogCheckedRef = useRef(false);
  useEffect(() => {
    if (changelogCheckedRef.current) return;
    changelogCheckedRef.current = true;
    const seenVersion = readSeenVersion(container.updateCachePath);
    if (seenVersion !== APP_VERSION) {
      // Show all versions newer than seenVersion, up to and including APP_VERSION.
      // e.g. upgrading from 0.5.0 → 0.7.0 shows entries for 0.6.x and 0.7.0.
      const newEntries = CHANGELOG_ENTRIES.filter(
        (e) =>
          isNewerVersion(e.version, seenVersion ?? '0.0.0') &&
          !isNewerVersion(e.version, APP_VERSION),
      );
      if (newEntries.length > 0) {
        logger.info(
          `TUI.changelog: showing ticker for [${newEntries.map((e) => e.version).join(', ')}] (last seen: ${seenVersion ?? 'none'})`,
        );
        dispatch({ type: 'SET_CHANGELOG', entries: newEntries });
        // Mark as seen immediately — ticker is a session-only notification.
        writeSeenVersion(container.updateCachePath, APP_VERSION);
      }
    }
  }, [container.updateCachePath]);

  // Reload tasks and epics when project or filter changes
  useEffect(() => {
    if (state.activeProject) {
      loadTasks();
      loadEpics();
    }
  }, [state.activeProject, state.filter, loadTasks, loadEpics]);

  // Auto-clear flash
  useEffect(() => {
    if (state.flash) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_FLASH' });
      }, 3000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [state.flash]);

  // Keyboard handler
  useInput((input, key) => {
    // Handle changelog dialog (opened with W) — modal while visible
    if (state.changelogDialogOpen) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'CHANGELOG_NAVIGATE', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'CHANGELOG_NAVIGATE', direction: 'down' });
        return;
      }
      if (key.escape || input === 'q' || input === 'W') {
        dispatch({ type: 'CLOSE_CHANGELOG_DIALOG' });
        return;
      }
      return;
    }

    // Handle confirm delete dialog
    if (state.confirmDelete) {
      if (input === 'y') {
        const result = container.taskService.deleteTask(state.confirmDelete.id);
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Task deleted', level: 'info' });
          dispatch({ type: 'CANCEL_DELETE' });
          if (state.activeView === ViewType.TaskDetail) {
            dispatch({ type: 'GO_BACK' });
          }
          loadTasks();
          loadEpics();
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
          dispatch({ type: 'CANCEL_DELETE' });
        }
      } else if (input === 'n' || key.escape) {
        dispatch({ type: 'CANCEL_DELETE' });
      }
      return;
    }

    // Handle detected-git-remote dialog
    if (state.detectedGitRemote && state.activeView === ViewType.TaskList) {
      if (input === 'y') {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectCreate });
      } else if (input === 'n' || key.escape) {
        dismissRemote(container.dismissedGitRemotesPath, state.detectedGitRemote);
        dispatch({ type: 'SET_DETECTED_GIT_REMOTE', remote: null });
      }
      return;
    }

    // Help view - any key closes
    if (state.activeView === ViewType.Help) {
      dispatch({ type: 'GO_BACK' });
      return;
    }

    // Form/selector/picker views handle their own input
    if (
      state.activeView === ViewType.TaskCreate ||
      state.activeView === ViewType.TaskEdit ||
      state.activeView === ViewType.ProjectSelector ||
      state.activeView === ViewType.ProjectCreate ||
      state.activeView === ViewType.ProjectEdit ||
      state.activeView === ViewType.ProjectLink ||
      state.activeView === ViewType.EpicPicker
    ) {
      return;
    }

    // Dep add-input mode: handle inline then return
    if (state.activeView === ViewType.DependencyList && state.isAddingDep) {
      if (key.escape) {
        dispatch({ type: 'SET_ADDING_DEP', active: false });
        return;
      }
      if (key.return && state.addDepInput.trim() && state.selectedTask) {
        // Format: "TASK-ID" or "TASK-ID:relates-to" or "TASK-ID:duplicates"
        const raw = state.addDepInput.trim();
        const colonIdx = raw.lastIndexOf(':');
        const validTypes = new Set(['blocks', 'relates-to', 'duplicates']);
        let depId: string;
        let depType: string | undefined;
        if (colonIdx > 0) {
          const maybetype = raw.slice(colonIdx + 1);
          if (validTypes.has(maybetype)) {
            depId = raw.slice(0, colonIdx);
            depType = maybetype;
          } else {
            depId = raw;
          }
        } else {
          depId = raw;
        }
        const result = container.dependencyService.addDependency({
          taskId: state.selectedTask.id,
          dependsOnId: depId,
          type: depType,
        });
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Dependency added', level: 'info' });
          loadDeps(state.selectedTask.id);
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
        }
        dispatch({ type: 'SET_ADDING_DEP', active: false });
        return;
      }
      if (key.backspace || key.delete) {
        dispatch({ type: 'SET_ADD_DEP_INPUT', input: state.addDepInput.slice(0, -1) });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'SET_ADD_DEP_INPUT', input: state.addDepInput + input });
        return;
      }
      return;
    }

    // Search mode
    if (state.isSearchActive) {
      if (key.escape) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
        dispatch({ type: 'SET_FILTER', filter: { search: undefined } });
        return;
      }
      if (key.return) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_FILTER', filter: { search: state.searchQuery || undefined } });
        return;
      }
      if (key.backspace || key.delete) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: state.searchQuery.slice(0, -1) });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: state.searchQuery + input });
        return;
      }
      return;
    }

    // Tab switching — only from root views (TaskList or Settings), no modal active
    const isRootView =
      state.activeView === ViewType.TaskList || state.activeView === ViewType.Settings;
    const noModal =
      !state.changelogEntries &&
      !state.detectedGitRemote &&
      !state.isReordering &&
      !state.isEpicReordering &&
      !state.isAddingDep;

    if (noModal && isRootView) {
      if (input === '1') {
        dispatch({ type: 'SWITCH_TAB', tab: TopTab.Tasks });
        return;
      }
      if (input === '2') {
        dispatch({ type: 'SWITCH_TAB', tab: TopTab.Settings });
        return;
      }
    }

    // Epic reorder mode
    if (state.isEpicReordering) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'EPIC_REORDER_MOVE', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'EPIC_REORDER_MOVE', direction: 'down' });
        return;
      }
      if (input === 't') {
        rerankSelectedToEdge('epic', 'top');
        return;
      }
      if (input === 'b') {
        rerankSelectedToEdge('epic', 'bottom');
        return;
      }
      if (key.rightArrow) {
        saveEpicReorder();
        return;
      }
      if (key.escape || key.leftArrow) {
        dispatch({ type: 'EXIT_EPIC_REORDER', save: false });
        dispatch({ type: 'FLASH', message: 'Epic reorder cancelled', level: 'info' });
        return;
      }
      return;
    }

    // Reorder mode
    if (state.isReordering) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'REORDER_MOVE', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'REORDER_MOVE', direction: 'down' });
        return;
      }
      if (input === 't') {
        rerankSelectedToEdge('task', 'top');
        return;
      }
      if (input === 'b') {
        rerankSelectedToEdge('task', 'bottom');
        return;
      }
      if (key.rightArrow) {
        saveReorder();
        return;
      }
      if (key.escape || key.leftArrow) {
        dispatch({ type: 'EXIT_REORDER', save: false });
        dispatch({ type: 'FLASH', message: 'Reorder cancelled', level: 'info' });
        return;
      }
      return;
    }

    // Global
    if (
      input === 'q' &&
      (state.activeView === ViewType.Settings ||
        (state.activeView === ViewType.TaskList && state.focusedPanel === 'list'))
    ) {
      exit();
      return;
    }
    if (input === 'q' || key.escape) {
      // In split view with detail focused: escape/q returns focus to list
      if (state.activeView === ViewType.TaskList && state.focusedPanel === 'detail') {
        dispatch({ type: 'SET_PANEL_FOCUS', panel: 'list' });
        return;
      }
      dispatch({ type: 'GO_BACK' });
      return;
    }
    if (input === '?') {
      dispatch({ type: 'NAVIGATE_TO', view: ViewType.Help });
      return;
    }

    // Tab / Shift+Tab: cycle panel focus forward or backward
    if (key.tab && state.activeView === ViewType.TaskList) {
      const panels: Array<'epic' | 'list' | 'detail'> = previewItem
        ? ['epic', 'list', 'detail']
        : ['epic', 'list'];
      const curIdx = panels.indexOf(state.focusedPanel);
      const delta = key.shift ? -1 : 1;
      const nextPanel = panels[(curIdx + delta + panels.length) % panels.length] ?? 'list';
      dispatch({ type: 'SET_PANEL_FOCUS', panel: nextPanel });
      return;
    }

    // Task List — epic panel focused
    if (state.activeView === ViewType.TaskList && state.focusedPanel === 'epic') {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'EPIC_MOVE_CURSOR', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'EPIC_MOVE_CURSOR', direction: 'down' });
        return;
      }
      if (input === ' ' || key.return) {
        const epic = state.epics[state.epicSelectedIndex];
        if (epic) {
          dispatch({ type: 'TOGGLE_EPIC', epicId: epic.id });
        }
        return;
      }
      if (input === '0') {
        dispatch({ type: 'CLEAR_EPIC_SELECTION' });
        return;
      }
      if (key.leftArrow) {
        if (state.epics.length > 0) {
          dispatch({ type: 'ENTER_EPIC_REORDER' });
          dispatch({
            type: 'FLASH',
            message: 'Reorder: ↑↓ move, t top, b bottom, → save, ← cancel',
            level: 'info',
          });
        }
        return;
      }
      if (input === 'q') {
        exit();
        return;
      }
    }

    // Task List — list panel focused
    if (state.activeView === ViewType.TaskList && state.focusedPanel === 'list') {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'MOVE_CURSOR', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'MOVE_CURSOR', direction: 'down' });
        return;
      }
      // g = go to top, G = go to bottom
      if (input === 'g') {
        dispatch({ type: 'SET_CURSOR', index: 0 });
        return;
      }
      if (input === 'G') {
        dispatch({ type: 'SET_CURSOR', index: state.tasks.length - 1 });
        return;
      }
      if (key.pageDown || (key.ctrl && input === 'd')) {
        dispatch({ type: 'PAGE_CURSOR', direction: 'down' });
        return;
      }
      if (key.pageUp || (key.ctrl && input === 'u')) {
        dispatch({ type: 'PAGE_CURSOR', direction: 'up' });
        return;
      }
      if (key.return) {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'SELECT_TASK', task });
          loadDeps(task.id);
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskDetail });
        }
        return;
      }
      if (input === 'c') {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskCreate });
        return;
      }
      if (input === 'e') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'SELECT_TASK', task });
          loadDeps(task.id);
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskEdit });
        }
        return;
      }
      if (input === 'd') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'CONFIRM_DELETE', task });
        }
        return;
      }
      if (input === 's') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          cycleStatus(task);
        }
        return;
      }
      if (input === 'a') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'SELECT_TASK', task });
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.EpicPicker });
        }
        return;
      }
      if (input === 'A') {
        const task = state.tasks[state.selectedIndex];
        if (task && task.parentId) {
          const result = container.taskService.updateTask(task.id, { parentId: null });
          if (result.ok) {
            dispatch({ type: 'FLASH', message: 'Unassigned from epic', level: 'info' });
            loadTasks();
            loadEpics();
          } else {
            dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
          }
        } else if (task) {
          dispatch({ type: 'FLASH', message: 'Task has no epic', level: 'warn' });
        }
        return;
      }
      if (input === '/') {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: true });
        dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
        return;
      }
      if (input === 'p') {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectSelector });
        return;
      }
      // Left arrow: enter reorder mode (only when no epic filter active)
      if (key.leftArrow) {
        if (state.selectedEpicIds.size > 0) {
          dispatch({
            type: 'FLASH',
            message: 'Clear epic filter (0) before reordering',
            level: 'warn',
          });
          return;
        }
        if (state.filter.status || state.filter.type || state.filter.search) {
          dispatch({
            type: 'FLASH',
            message: 'Clear filters (0) before reordering',
            level: 'warn',
          });
          return;
        }
        if (state.tasks.length > 0) {
          dispatch({ type: 'ENTER_REORDER' });
          dispatch({
            type: 'FLASH',
            message: 'Reorder: ↑↓ move, t top, b bottom, → save, ← cancel',
            level: 'info',
          });
        }
        return;
      }
      if (input === 'f') {
        const currentStatus = state.filter.status;
        const currentIndex = currentStatus
          ? STATUS_VALUES.indexOf(currentStatus as TaskStatus)
          : -1;
        const nextIndex = currentIndex + 1;
        const nextStatus = nextIndex < STATUS_VALUES.length ? STATUS_VALUES[nextIndex] : undefined;
        dispatch({ type: 'SET_FILTER', filter: { status: nextStatus } });
        return;
      }
      if (input === 't') {
        const currentType = state.filter.type;
        const currentIndex = currentType ? TYPE_VALUES.indexOf(currentType as TaskType) : -1;
        const nextIndex = currentIndex + 1;
        const nextType = nextIndex < TYPE_VALUES.length ? TYPE_VALUES[nextIndex] : undefined;
        dispatch({ type: 'SET_FILTER', filter: { type: nextType } });
        return;
      }
      if (input === '0') {
        dispatch({ type: 'CLEAR_FILTER' });
        return;
      }
      if (input === 'W' && state.changelogEntries) {
        dispatch({ type: 'OPEN_CHANGELOG_DIALOG' });
        return;
      }
    }

    // Task List — detail panel focused (preview task shortcuts)
    if (state.activeView === ViewType.TaskList && state.focusedPanel === 'detail' && previewItem) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'DETAIL_SCROLL', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'DETAIL_SCROLL', direction: 'down' });
        return;
      }
      if (input === 'e') {
        dispatch({ type: 'SELECT_TASK', task: previewItem });
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskEdit });
        return;
      }
      if (input === 'd') {
        dispatch({ type: 'CONFIRM_DELETE', task: previewItem });
        return;
      }
      if (input === 's') {
        cycleStatus(previewItem);
        return;
      }
      if (input === 'm') {
        const allText = `${previewItem.description}\n${previewItem.technicalNotes}\n${previewItem.additionalRequirements}`;
        const count = openAllMermaidDiagrams(allText);
        if (count > 0) {
          dispatch({
            type: 'FLASH',
            message: `Opened ${count} diagram${count > 1 ? 's' : ''} in browser`,
            level: 'info',
          });
        }
        return;
      }
      if (input === 'D') {
        dispatch({ type: 'SELECT_TASK', task: previewItem });
        loadDeps(previewItem.id);
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.DependencyList });
        return;
      }
    }

    // Task Detail (full-screen)
    if (state.activeView === ViewType.TaskDetail) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'DETAIL_SCROLL', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'DETAIL_SCROLL', direction: 'down' });
        return;
      }
      if (input === 'e' && state.selectedTask) {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskEdit });
        return;
      }
      if (input === 'd' && state.selectedTask) {
        dispatch({ type: 'CONFIRM_DELETE', task: state.selectedTask });
        return;
      }
      if (input === 's' && state.selectedTask) {
        cycleStatus(state.selectedTask);
        return;
      }
      if (input === 'm' && state.selectedTask) {
        const allText = `${state.selectedTask.description}\n${state.selectedTask.technicalNotes}\n${state.selectedTask.additionalRequirements}`;
        const count = openAllMermaidDiagrams(allText);
        if (count > 0) {
          dispatch({
            type: 'FLASH',
            message: `Opened ${count} diagram${count > 1 ? 's' : ''} in browser`,
            level: 'info',
          });
        }
        return;
      }
      if (input === 'D' && state.selectedTask) {
        loadDeps(state.selectedTask.id);
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.DependencyList });
        return;
      }
    }

    // Dependency List (non-adding mode — adding is handled above)
    if (state.activeView === ViewType.DependencyList && state.selectedTask) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'DEP_MOVE_CURSOR', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'DEP_MOVE_CURSOR', direction: 'down' });
        return;
      }
      if (input === 'a') {
        dispatch({ type: 'SET_ADDING_DEP', active: true });
        return;
      }
      if (input === 'x') {
        const allItems = [
          ...state.depBlockers,
          ...state.depDependents,
          ...state.depRelated,
          ...state.depDuplicates,
        ];
        const selected = allItems[state.depSelectedIndex];
        if (selected) {
          // removeDependencyBetween handles direction-agnostic removal for
          // all relationship types (blockers, dependents, related, duplicates).
          const result = container.dependencyService.removeDependencyBetween(
            state.selectedTask.id,
            selected.id,
          );
          if (result.ok) {
            dispatch({ type: 'FLASH', message: 'Dependency removed', level: 'info' });
            loadDeps(state.selectedTask.id);
          } else {
            dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
          }
        }
        return;
      }
      if (key.return) {
        const allItems = [
          ...state.depBlockers,
          ...state.depDependents,
          ...state.depRelated,
          ...state.depDuplicates,
        ];
        const selected = allItems[state.depSelectedIndex];
        if (selected) {
          dispatch({ type: 'SELECT_TASK', task: selected });
          loadDeps(selected.id);
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskDetail });
        }
        return;
      }
    }
  });

  const handleFormSave = useCallback(
    (data: {
      name: string;
      description: string;
      type: string;
      status: string;
      technicalNotes: string;
      additionalRequirements: string;
      dependsOn?: DependencyEntry[];
    }) => {
      if (state.activeView === ViewType.TaskEdit && state.selectedTask) {
        const taskId = state.selectedTask.id;
        const result = container.taskService.updateTask(taskId, data);
        if (!result.ok) {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
          return;
        }

        // Diff and apply dependency changes.
        // Current outgoing deps (what this task depends on, in stored direction).
        const currentDepsResult = container.dependencyService.listAllDeps(taskId);
        const currentDeps = currentDepsResult.ok ? currentDepsResult.value : [];

        // New desired outgoing deps from the form.
        const newDeps = data.dependsOn ?? [];

        // Build lookup keys: "dependsOnId:type" for outgoing edges.
        const currentKeys = new Set(currentDeps.map((d) => `${d.dependsOnId}:${d.type}`));
        const newKeys = new Set(newDeps.map((d) => `${d.id}:${d.type}`));

        // Remove edges that are no longer in new deps.
        for (const dep of currentDeps) {
          if (!newKeys.has(`${dep.dependsOnId}:${dep.type}`)) {
            container.dependencyService.removeDependency({
              taskId,
              dependsOnId: dep.dependsOnId,
            });
          }
        }

        // Add edges that are new (service handles blocked-by normalization).
        for (const entry of newDeps) {
          if (currentKeys.has(`${entry.id}:${entry.type}`)) continue;
          container.dependencyService.addDependency({
            taskId,
            dependsOnId: entry.id,
            type: entry.type,
          });
        }

        dispatch({ type: 'FLASH', message: 'Task updated', level: 'info' });
        dispatch({ type: 'SELECT_TASK', task: result.value });
        loadDeps(taskId);
        dispatch({ type: 'GO_BACK' });
        loadTasks();
        loadEpics();
      } else {
        if (!state.activeProject) return;
        const result = container.taskService.createTask(data, state.activeProject);
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Task created', level: 'info' });
          dispatch({ type: 'GO_BACK' });
          loadTasks();
          loadEpics();
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
        }
      }
    },
    [
      container,
      state.activeView,
      state.selectedTask,
      state.activeProject,
      loadTasks,
      loadDeps,
      loadEpics,
    ],
  );

  const handleFormCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const handleEpicPickerSelect = useCallback(
    (epicId: string | null) => {
      if (!state.selectedTask) return;
      const result = container.taskService.updateTask(state.selectedTask.id, {
        parentId: epicId,
      });
      if (result.ok) {
        const msg = epicId ? `Assigned to ${epicId}` : 'Unassigned from epic';
        dispatch({ type: 'FLASH', message: msg, level: 'info' });
        loadTasks();
        loadEpics();
      } else {
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
      dispatch({ type: 'GO_BACK' });
    },
    [container, state.selectedTask, loadTasks, loadEpics],
  );

  const handleEpicPickerCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const handleProjectSelect = useCallback((project: Project) => {
    dispatch({ type: 'SET_ACTIVE_PROJECT', project });
    dispatch({ type: 'GO_BACK' });
    dispatch({ type: 'FLASH', message: `Switched to: ${project.name}`, level: 'info' });
  }, []);

  const handleSetDefault = useCallback(
    (project: Project) => {
      const result = container.projectService.updateProject(project.id, { isDefault: true });
      if (result.ok) {
        logger.info(`TUI.setDefault: set key=${result.value.key} as default`);
        dispatch({
          type: 'FLASH',
          message: `Default project: ${result.value.name}`,
          level: 'info',
        });
        loadProjects();
      } else {
        logger.error('TUI.setDefault: failed', result.error);
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    },
    [container, loadProjects],
  );

  const handleProjectCreate = useCallback(() => {
    dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectCreate });
  }, []);

  const handleProjectEdit = useCallback((project: Project) => {
    dispatch({ type: 'SET_EDITING_PROJECT', project });
    dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectEdit });
  }, []);

  const handleProjectFormSave = useCallback(
    (data: {
      name: string;
      key: string;
      description: string;
      isDefault: boolean;
      gitRemote: string;
    }) => {
      const editing = state.activeView === ViewType.ProjectEdit ? state.editingProject : null;
      const result = editing
        ? container.projectService.updateProject(editing.id, {
            name: data.name,
            description: data.description,
            isDefault: data.isDefault,
            gitRemote: data.gitRemote || null,
          })
        : container.projectService.createProject({
            name: data.name,
            key: data.key || undefined,
            description: data.description || undefined,
            isDefault: data.isDefault,
            gitRemote: data.gitRemote || undefined,
          });

      if (result.ok) {
        const verb = editing ? 'updated' : 'created';
        logger.info(
          `TUI.${editing ? 'editProject' : 'createProject'}: ${verb} key=${result.value.key} name=${result.value.name}`,
        );
        dispatch({
          type: 'FLASH',
          message: `Project ${verb}: ${result.value.name}`,
          level: 'info',
        });

        if (editing && state.activeProject?.id === result.value.id) {
          dispatch({ type: 'SET_ACTIVE_PROJECT', project: result.value });
        }
        if (!editing) {
          dispatch({ type: 'SET_ACTIVE_PROJECT', project: result.value });
          // Go back past ProjectCreate and ProjectSelector to TaskList
          dispatch({ type: 'GO_BACK' });
        }
        dispatch({ type: 'GO_BACK' });
        loadProjects();
      } else {
        logger.error(`TUI.${editing ? 'editProject' : 'createProject'}: failed`, result.error);
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    },
    [container, state.activeView, state.editingProject, state.activeProject, loadProjects],
  );

  const handleProjectFormCancel = useCallback(() => {
    if (state.activeView === ViewType.ProjectCreate && state.detectedGitRemote) {
      dismissRemote(container.dismissedGitRemotesPath, state.detectedGitRemote);
    }
    dispatch({ type: 'GO_BACK' });
  }, [state.activeView, state.detectedGitRemote, container]);

  const handleProjectLink = useCallback((project: Project) => {
    dispatch({ type: 'SET_LINKING_PROJECT', project });
    dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectLink });
  }, []);

  const handleLinkSave = useCallback(
    (remote: string) => {
      if (!state.linkingProject) return;
      const result = container.projectService.linkGitRemote(state.linkingProject.id, remote);
      if (result.ok) {
        logger.info(
          `TUI.linkGitRemote: linked project=${state.linkingProject.id} remote=${result.value.gitRemote?.value}`,
        );
        dispatch({
          type: 'FLASH',
          message: `Linked to: ${result.value.gitRemote?.value}`,
          level: 'info',
        });
        dispatch({ type: 'GO_BACK' });
        loadProjects();
      } else {
        logger.error('TUI.linkGitRemote: failed', result.error);
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    },
    [container, state.linkingProject, loadProjects],
  );

  const handleLinkUnlink = useCallback(() => {
    if (!state.linkingProject) return;
    const result = container.projectService.unlinkGitRemote(state.linkingProject.id);
    if (result.ok) {
      logger.info(`TUI.unlinkGitRemote: unlinked project=${state.linkingProject.id}`);
      dispatch({ type: 'FLASH', message: 'Git remote unlinked', level: 'info' });
      dispatch({ type: 'GO_BACK' });
      loadProjects();
    } else {
      logger.error('TUI.unlinkGitRemote: failed', result.error);
      dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
    }
  }, [container, state.linkingProject, loadProjects]);

  const handleLinkDetect = useCallback((): string | null => {
    const result = detectGitRemote();
    if (result.ok && result.value) {
      dispatch({ type: 'FLASH', message: `Detected: ${result.value.value}`, level: 'info' });
      return result.value.value;
    }
    dispatch({ type: 'FLASH', message: 'No git remote detected in cwd', level: 'warn' });
    return null;
  }, []);

  const handleLinkCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const handleProjectCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const previewItem: Task | null =
    state.focusedPanel === 'epic'
      ? (state.epics[state.epicSelectedIndex] ?? null)
      : (state.tasks[state.selectedIndex] ?? null);

  // Derive initial deps for the edit form from the already-loaded dep state.
  // depBlockers = tasks the selected task depends on (outgoing blocks edges).
  // depRelated / depDuplicates = bidirectional, but we seed them as outgoing.
  const initialDepsForEdit = useMemo((): import('./TaskPicker.js').PickedDependency[] => {
    return [
      ...state.depBlockers.map((t) => ({ id: t.id, name: t.name, type: DependencyType.Blocks })),
      ...state.depRelated.map((t) => ({ id: t.id, name: t.name, type: DependencyType.RelatesTo })),
      ...state.depDuplicates.map((t) => ({
        id: t.id,
        name: t.name,
        type: DependencyType.Duplicates,
      })),
    ];
  }, [state.depBlockers, state.depRelated, state.depDuplicates]);

  // All project tasks (unfiltered) for the dependency picker.
  // Depends on state.tasks so it re-fetches whenever loadTasks() updates the list
  // (e.g. after a task is created), ensuring newly created tasks appear in the picker.
  const allProjectTasks = useMemo(() => {
    if (!state.activeProject) return [];
    const result = container.taskService.listTasks(state.activeProject, {});
    return result.ok ? result.value : [];
  }, [container, state.activeProject, state.tasks]);
  const previewItemId = previewItem?.id ?? null;

  // Load deps for the preview pane when selection changes (track ID, not object reference)
  useEffect(() => {
    if (state.activeView === ViewType.TaskList && previewItemId) {
      loadDeps(previewItemId);
    }
  }, [state.activeView, previewItemId, loadDeps]);

  return (
    <Box flexDirection="column" height={stdout.rows}>
      {/* Header: app info + key hints + logo */}
      <Header state={state} latestVersion={latestVersion} />

      {/* Tab bar: Tasks / Settings */}
      <TabBar activeTab={state.activeTab} />

      {/* Settings tab */}
      {state.activeTab === TopTab.Settings && <SettingsView />}

      {/* Content area (Tasks tab) */}
      {state.activeTab === TopTab.Tasks && (
        <Box flexDirection="column" flexGrow={1} overflowY="hidden">
          {state.confirmDelete && <ConfirmDialog task={state.confirmDelete} />}

          {!state.confirmDelete &&
            state.changelogEntries &&
            state.changelogDialogOpen &&
            state.activeView === ViewType.TaskList && (
              <ChangelogBanner
                entries={state.changelogEntries}
                currentIndex={state.changelogIndex}
              />
            )}

          {/* Task list: always visible (ticker is non-blocking in the header) */}
          {!state.confirmDelete &&
            !state.changelogDialogOpen &&
            state.activeView === ViewType.TaskList &&
            (state.detectedGitRemote ? (
              <DetectedProjectDialog remote={state.detectedGitRemote} />
            ) : (
              <Box flexDirection="row" flexGrow={1}>
                <EpicPanel
                  epics={state.epics}
                  selectedIndex={state.epicSelectedIndex}
                  selectedEpicIds={state.selectedEpicIds}
                  isFocused={state.focusedPanel === 'epic'}
                  isReordering={state.isEpicReordering}
                />
                <Box width={taskListWidth}>
                  <TaskList
                    tasks={state.tasks}
                    selectedIndex={state.selectedIndex}
                    searchQuery={state.searchQuery}
                    isSearchActive={state.isSearchActive}
                    isReordering={state.isReordering}
                    filter={state.filter}
                    activeProjectName={state.activeProject?.name ?? 'none'}
                    nonTerminalBlockerIds={
                      new Set(
                        state.depBlockers
                          .filter((t) => !isTerminalStatus(t.status))
                          .map((t) => t.id),
                      )
                    }
                    nonTerminalDependentIds={
                      new Set(
                        state.depDependents
                          .filter((t) => !isTerminalStatus(t.status))
                          .map((t) => t.id),
                      )
                    }
                    isSelectedBlocked={state.depBlockers.some((t) => !isTerminalStatus(t.status))}
                    isFocused={state.focusedPanel === 'list'}
                    epicFilterActive={state.selectedEpicIds.size > 0}
                  />
                </Box>
                <Box width={taskDetailWidth}>
                  {previewItem ? (
                    <TaskDetail
                      task={previewItem}
                      blockers={state.depBlockers}
                      dependents={state.depDependents}
                      related={state.depRelated}
                      duplicates={state.depDuplicates}
                      isFocused={state.focusedPanel === 'detail'}
                      scrollOffset={state.detailScrollOffset}
                    />
                  ) : (
                    <Box
                      flexDirection="column"
                      flexGrow={1}
                      borderStyle="bold"
                      borderColor={theme.border}
                    >
                      <Box>
                        <Text color={theme.title} bold>
                          {' '}
                          detail
                        </Text>
                      </Box>
                      <Box flexGrow={1} justifyContent="center" alignItems="center">
                        <Text dimColor>No task selected</Text>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}

          {!state.confirmDelete &&
            state.activeView === ViewType.TaskDetail &&
            state.selectedTask && (
              <TaskDetail
                task={state.selectedTask}
                blockers={state.depBlockers}
                dependents={state.depDependents}
                related={state.depRelated}
                duplicates={state.depDuplicates}
                scrollOffset={state.detailScrollOffset}
              />
            )}

          {!state.confirmDelete &&
            state.activeView === ViewType.DependencyList &&
            state.selectedTask && (
              <DependencyList
                task={state.selectedTask}
                blockers={state.depBlockers}
                dependents={state.depDependents}
                related={state.depRelated}
                duplicates={state.depDuplicates}
                selectedIndex={state.depSelectedIndex}
                isAddingDep={state.isAddingDep}
                addDepInput={state.addDepInput}
              />
            )}

          {!state.confirmDelete &&
            (state.activeView === ViewType.TaskCreate ||
              state.activeView === ViewType.TaskEdit) && (
              <TaskForm
                editingTask={state.activeView === ViewType.TaskEdit ? state.selectedTask : null}
                allTasks={allProjectTasks}
                initialDeps={
                  state.activeView === ViewType.TaskEdit ? initialDepsForEdit : undefined
                }
                onSave={handleFormSave}
                onCancel={handleFormCancel}
              />
            )}

          {!state.confirmDelete &&
            state.activeView === ViewType.EpicPicker &&
            state.selectedTask && (
              <EpicPicker
                epics={state.epics}
                currentEpicId={state.selectedTask.parentId}
                onSelect={handleEpicPickerSelect}
                onCancel={handleEpicPickerCancel}
              />
            )}

          {!state.confirmDelete && state.activeView === ViewType.ProjectSelector && (
            <ProjectSelector
              projects={state.projects}
              activeProject={state.activeProject}
              onSelect={handleProjectSelect}
              onCreate={handleProjectCreate}
              onEdit={handleProjectEdit}
              onSetDefault={handleSetDefault}
              onLink={handleProjectLink}
              onCancel={handleProjectCancel}
            />
          )}

          {!state.confirmDelete && state.activeView === ViewType.ProjectCreate && (
            <ProjectForm
              initialGitRemote={state.detectedGitRemote ?? undefined}
              onSave={handleProjectFormSave}
              onCancel={handleProjectFormCancel}
            />
          )}

          {!state.confirmDelete &&
            state.activeView === ViewType.ProjectEdit &&
            state.editingProject && (
              <ProjectForm
                editingProject={state.editingProject}
                onSave={handleProjectFormSave}
                onCancel={handleProjectFormCancel}
              />
            )}

          {!state.confirmDelete &&
            state.activeView === ViewType.ProjectLink &&
            state.linkingProject && (
              <ProjectLinkForm
                project={state.linkingProject}
                onSave={handleLinkSave}
                onUnlink={handleLinkUnlink}
                onDetect={handleLinkDetect}
                onCancel={handleLinkCancel}
              />
            )}

          {!state.confirmDelete && state.activeView === ViewType.Help && <HelpOverlay />}
        </Box>
      )}

      {/* Breadcrumbs */}
      <Crumbs breadcrumbs={state.breadcrumbs} />

      {/* Flash message */}
      {state.flash && <FlashMessage message={state.flash.message} level={state.flash.level} />}
    </Box>
  );
}
