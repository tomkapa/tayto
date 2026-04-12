import { ViewType } from './types.js';
import type { AppState, Action } from './types.js';
import { PAGE_SIZE } from './constants.js';

export const initialState: AppState = {
  activeView: ViewType.TaskList,
  breadcrumbs: [ViewType.TaskList],
  tasks: [],
  selectedIndex: 0,
  selectedTask: null,
  projects: [],
  activeProject: null,
  filter: {},
  searchQuery: '',
  isSearchActive: false,
  isReordering: false,
  reorderSnapshot: null,
  flash: null,
  confirmDelete: null,
  formData: null,
  depBlockers: [],
  depDependents: [],
  depRelated: [],
  depDuplicates: [],
  depSelectedIndex: 0,
  isAddingDep: false,
  addDepInput: '',
  focusedPanel: 'list',
  detailScrollOffset: 0,
  epics: [],
  epicSelectedIndex: 0,
  selectedEpicIds: new Set(),
  linkingProject: null,
  editingProject: null,
  isEpicReordering: false,
  epicReorderSnapshot: null,
};

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE_TO':
      return {
        ...state,
        breadcrumbs: [...state.breadcrumbs, action.view],
        activeView: action.view,
        confirmDelete: null,
        focusedPanel: 'list',
      };

    case 'GO_BACK': {
      const crumbs =
        state.breadcrumbs.length > 1 ? state.breadcrumbs.slice(0, -1) : [ViewType.TaskList];
      return {
        ...state,
        activeView: crumbs[crumbs.length - 1] ?? ViewType.TaskList,
        breadcrumbs: crumbs,
        confirmDelete: null,
        isSearchActive: false,
        formData: null,
        linkingProject: null,
        editingProject: null,
        focusedPanel: 'list',
      };
    }

    case 'SET_TASKS':
      return {
        ...state,
        tasks: action.tasks,
        selectedIndex: Math.min(state.selectedIndex, Math.max(0, action.tasks.length - 1)),
      };

    case 'SET_PROJECTS':
      return { ...state, projects: action.projects };

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProject: action.project };

    case 'SET_FILTER':
      return {
        ...state,
        filter: { ...state.filter, ...action.filter },
        selectedIndex: 0,
      };

    case 'CLEAR_FILTER':
      return { ...state, filter: {}, selectedIndex: 0, searchQuery: '' };

    case 'SET_SEARCH_ACTIVE':
      return { ...state, isSearchActive: action.active };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'FLASH':
      return {
        ...state,
        flash: { message: action.message, level: action.level },
      };

    case 'CLEAR_FLASH':
      return { ...state, flash: null };

    case 'CONFIRM_DELETE':
      return { ...state, confirmDelete: action.task };

    case 'CANCEL_DELETE':
      return { ...state, confirmDelete: null };

    case 'MOVE_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      const newIndex =
        action.direction === 'up'
          ? Math.max(0, state.selectedIndex - 1)
          : Math.min(maxIndex, state.selectedIndex + 1);
      return { ...state, selectedIndex: newIndex, detailScrollOffset: 0 };
    }

    case 'PAGE_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      const newIndex =
        action.direction === 'up'
          ? Math.max(0, state.selectedIndex - PAGE_SIZE)
          : Math.min(maxIndex, state.selectedIndex + PAGE_SIZE);
      return { ...state, selectedIndex: newIndex, detailScrollOffset: 0 };
    }

    case 'SET_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      return { ...state, selectedIndex: Math.max(0, Math.min(action.index, maxIndex)) };
    }

    case 'SELECT_TASK':
      return { ...state, selectedTask: action.task, detailScrollOffset: 0 };

    case 'SET_FORM_DATA':
      return { ...state, formData: action.data };

    case 'ENTER_REORDER':
      return {
        ...state,
        isReordering: true,
        reorderSnapshot: [...state.tasks],
      };

    case 'REORDER_MOVE': {
      if (!state.isReordering) return state;
      const idx = state.selectedIndex;
      const tasks = [...state.tasks];
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= tasks.length) return state;

      // Swap tasks in the local array
      const current = tasks[idx];
      const swap = tasks[swapIdx];
      if (!current || !swap) return state;
      tasks[idx] = swap;
      tasks[swapIdx] = current;

      return {
        ...state,
        tasks,
        selectedIndex: swapIdx,
      };
    }

    case 'EXIT_REORDER': {
      if (!action.save && state.reorderSnapshot) {
        // Revert to snapshot
        return {
          ...state,
          isReordering: false,
          tasks: state.reorderSnapshot,
          reorderSnapshot: null,
        };
      }
      return {
        ...state,
        isReordering: false,
        reorderSnapshot: null,
      };
    }

    case 'SET_DEPS':
      return {
        ...state,
        depBlockers: action.blockers,
        depDependents: action.dependents,
        depRelated: action.related,
        depDuplicates: action.duplicates,
        depSelectedIndex: 0,
      };

    case 'DEP_MOVE_CURSOR': {
      const total =
        state.depBlockers.length +
        state.depDependents.length +
        state.depRelated.length +
        state.depDuplicates.length;
      if (total === 0) return state;
      const maxIdx = Math.max(0, total - 1);
      const newIdx =
        action.direction === 'up'
          ? Math.max(0, state.depSelectedIndex - 1)
          : Math.min(maxIdx, state.depSelectedIndex + 1);
      return { ...state, depSelectedIndex: newIdx };
    }

    case 'SET_ADDING_DEP':
      return { ...state, isAddingDep: action.active, addDepInput: '' };

    case 'SET_ADD_DEP_INPUT':
      return { ...state, addDepInput: action.input };

    case 'SET_PANEL_FOCUS':
      return { ...state, focusedPanel: action.panel };

    case 'DETAIL_SCROLL':
      return {
        ...state,
        detailScrollOffset:
          action.direction === 'up'
            ? Math.max(0, state.detailScrollOffset - 1)
            : state.detailScrollOffset + 1,
      };

    case 'DETAIL_RESET_SCROLL':
      return { ...state, detailScrollOffset: 0 };

    case 'SET_EPICS':
      return {
        ...state,
        epics: action.epics,
        epicSelectedIndex: Math.min(state.epicSelectedIndex, Math.max(0, action.epics.length - 1)),
      };

    case 'EPIC_MOVE_CURSOR': {
      if (state.epics.length === 0) return state;
      const maxIdx = Math.max(0, state.epics.length - 1);
      const newIdx =
        action.direction === 'up'
          ? Math.max(0, state.epicSelectedIndex - 1)
          : Math.min(maxIdx, state.epicSelectedIndex + 1);
      return { ...state, epicSelectedIndex: newIdx };
    }

    case 'TOGGLE_EPIC': {
      const next = new Set(state.selectedEpicIds);
      if (next.has(action.epicId)) {
        next.delete(action.epicId);
      } else {
        next.add(action.epicId);
      }
      return { ...state, selectedEpicIds: next, selectedIndex: 0 };
    }

    case 'CLEAR_EPIC_SELECTION':
      return { ...state, selectedEpicIds: new Set(), selectedIndex: 0 };

    case 'ENTER_EPIC_REORDER':
      return {
        ...state,
        isEpicReordering: true,
        epicReorderSnapshot: [...state.epics],
      };

    case 'EPIC_REORDER_MOVE': {
      if (!state.isEpicReordering) return state;
      const idx = state.epicSelectedIndex;
      const epics = [...state.epics];
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= epics.length) return state;

      const current = epics[idx];
      const swap = epics[swapIdx];
      if (!current || !swap) return state;
      epics[idx] = swap;
      epics[swapIdx] = current;

      return {
        ...state,
        epics,
        epicSelectedIndex: swapIdx,
      };
    }

    case 'EXIT_EPIC_REORDER': {
      if (!action.save && state.epicReorderSnapshot) {
        return {
          ...state,
          isEpicReordering: false,
          epics: state.epicReorderSnapshot,
          epicReorderSnapshot: null,
        };
      }
      return {
        ...state,
        isEpicReordering: false,
        epicReorderSnapshot: null,
      };
    }

    case 'SET_LINKING_PROJECT':
      return { ...state, linkingProject: action.project };

    case 'SET_EDITING_PROJECT':
      return { ...state, editingProject: action.project };
  }
}
