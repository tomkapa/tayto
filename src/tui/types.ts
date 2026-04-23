import type { Task } from '../types/task.js';
import type { Project } from '../types/project.js';
import type { TaskFilter } from '../types/task.js';
import type { GitRemote } from '../types/git-remote.js';
import type { ChangelogEntry } from '../utils/changelog-parser.js';

export const ViewType = {
  TaskList: 'task-list',
  TaskDetail: 'task-detail',
  TaskCreate: 'task-create',
  TaskEdit: 'task-edit',
  ProjectSelector: 'project-selector',
  ProjectCreate: 'project-create',
  ProjectEdit: 'project-edit',
  DependencyList: 'dependency-list',
  EpicPicker: 'epic-picker',
  ProjectLink: 'project-link',
  Help: 'help',
  Settings: 'settings',
} as const;
export type ViewType = (typeof ViewType)[keyof typeof ViewType];

export const TopTab = { Tasks: 'tasks', Settings: 'settings' } as const;
export type TopTab = (typeof TopTab)[keyof typeof TopTab];

export type FlashLevel = 'info' | 'warn' | 'error';

export type PanelFocus = 'epic' | 'list' | 'detail';

export interface AppState {
  activeView: ViewType;
  breadcrumbs: ViewType[];
  activeTab: TopTab;
  tasks: Task[];
  selectedIndex: number;
  selectedTask: Task | null;
  projects: Project[];
  activeProject: Project | null;
  filter: TaskFilter;
  searchQuery: string;
  isSearchActive: boolean;
  isReordering: boolean;
  reorderSnapshot: Task[] | null;
  flash: { message: string; level: FlashLevel } | null;
  confirmDelete: Task | null;
  formData: Partial<FormData> | null;
  depBlockers: Task[];
  depDependents: Task[];
  depRelated: Task[];
  depDuplicates: Task[];
  depSelectedIndex: number;
  isAddingDep: boolean;
  addDepInput: string;
  focusedPanel: PanelFocus;
  /** All epics in the active project (level 1 tasks). */
  epics: Task[];
  /** Cursor position in the epic panel. */
  epicSelectedIndex: number;
  /** IDs of selected epics for filtering. Empty = show all. */
  selectedEpicIds: Set<string>;
  /** Scroll offset for detail panel (lines from top). */
  detailScrollOffset: number;
  /** Project currently being linked to a git remote. */
  linkingProject: Project | null;
  /** Project currently being edited. */
  editingProject: Project | null;
  /** True when reordering epics. */
  isEpicReordering: boolean;
  /** Snapshot of epics before reorder started (for cancel/revert). */
  epicReorderSnapshot: Task[] | null;
  /**
   * Git remote detected in cwd that does not match any existing project.
   * When set, the "new project detected" dialog is shown.
   */
  detectedGitRemote: GitRemote | null;
  /**
   * New changelog entries (versions newer than last seen) shown in the header ticker.
   * null = no new versions since last launch.
   */
  changelogEntries: ChangelogEntry[] | null;
  /** Index of the currently viewed entry in the changelog dialog. */
  changelogIndex: number;
  /** True when the full changelog dialog is open (triggered by W). */
  changelogDialogOpen: boolean;
}

export interface FormData {
  name: string;
  description: string;
  type: string;
  status: string;
  technicalNotes: string;
  additionalRequirements: string;
}

export type Action =
  | { type: 'NAVIGATE_TO'; view: ViewType }
  | { type: 'GO_BACK' }
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'SET_ACTIVE_PROJECT'; project: Project | null }
  | { type: 'SET_FILTER'; filter: Partial<TaskFilter> }
  | { type: 'CLEAR_FILTER' }
  | { type: 'SET_SEARCH_ACTIVE'; active: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'FLASH'; message: string; level: FlashLevel }
  | { type: 'CLEAR_FLASH' }
  | { type: 'CONFIRM_DELETE'; task: Task }
  | { type: 'CANCEL_DELETE' }
  | { type: 'MOVE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'PAGE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'SET_CURSOR'; index: number }
  | { type: 'SELECT_TASK'; task: Task }
  | { type: 'SET_FORM_DATA'; data: Partial<FormData> | null }
  | { type: 'ENTER_REORDER' }
  | { type: 'REORDER_MOVE'; direction: 'up' | 'down' }
  | { type: 'EXIT_REORDER'; save: boolean }
  | { type: 'SET_DEPS'; blockers: Task[]; dependents: Task[]; related: Task[]; duplicates: Task[] }
  | { type: 'DEP_MOVE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'SET_ADDING_DEP'; active: boolean }
  | { type: 'SET_ADD_DEP_INPUT'; input: string }
  | { type: 'SET_PANEL_FOCUS'; panel: PanelFocus }
  | { type: 'SET_EPICS'; epics: Task[] }
  | { type: 'EPIC_MOVE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'TOGGLE_EPIC'; epicId: string }
  | { type: 'CLEAR_EPIC_SELECTION' }
  | { type: 'DETAIL_SCROLL'; direction: 'up' | 'down' }
  | { type: 'DETAIL_RESET_SCROLL' }
  | { type: 'ENTER_EPIC_REORDER' }
  | { type: 'EPIC_REORDER_MOVE'; direction: 'up' | 'down' }
  | { type: 'EXIT_EPIC_REORDER'; save: boolean }
  | { type: 'SET_LINKING_PROJECT'; project: Project | null }
  | { type: 'SET_EDITING_PROJECT'; project: Project | null }
  | { type: 'SET_DETECTED_GIT_REMOTE'; remote: GitRemote | null }
  | { type: 'SET_CHANGELOG'; entries: ChangelogEntry[] | null }
  | { type: 'CHANGELOG_NAVIGATE'; direction: 'up' | 'down' }
  | { type: 'DISMISS_CHANGELOG' }
  | { type: 'OPEN_CHANGELOG_DIALOG' }
  | { type: 'CLOSE_CHANGELOG_DIALOG' }
  | { type: 'SWITCH_TAB'; tab: TopTab };
