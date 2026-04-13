import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../src/tui/state.js';
import { ViewType } from '../../src/tui/types.js';
import type { Task } from '../../src/types/task.js';
import type { Project } from '../../src/types/project.js';

const mockTask: Task = {
  id: 'task-1',
  projectId: 'proj-1',
  parentId: null,
  name: 'Test task',
  description: 'A test task',
  type: 'story',
  status: 'backlog',
  rank: 1000,
  technicalNotes: '',
  additionalRequirements: '',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('appReducer', () => {
  it('starts with TaskList view and single breadcrumb', () => {
    expect(initialState.activeView).toBe(ViewType.TaskList);
    expect(initialState.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('defaults filter to empty (no filter)', () => {
    expect(initialState.filter).toEqual({});
  });

  it('NAVIGATE_TO changes view and pushes breadcrumb', () => {
    const state = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    expect(state.activeView).toBe(ViewType.TaskDetail);
    expect(state.breadcrumbs).toEqual([ViewType.TaskList, ViewType.TaskDetail]);
  });

  it('GO_BACK pops breadcrumb and returns to previous view', () => {
    const navigated = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    const back = appReducer(navigated, { type: 'GO_BACK' });
    expect(back.activeView).toBe(ViewType.TaskList);
    expect(back.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('GO_BACK defaults to TaskList when at root', () => {
    const back = appReducer(initialState, { type: 'GO_BACK' });
    expect(back.activeView).toBe(ViewType.TaskList);
    expect(back.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('supports deep breadcrumb navigation', () => {
    let state = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    state = appReducer(state, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskEdit,
    });
    expect(state.breadcrumbs).toEqual([ViewType.TaskList, ViewType.TaskDetail, ViewType.TaskEdit]);

    const back1 = appReducer(state, { type: 'GO_BACK' });
    expect(back1.activeView).toBe(ViewType.TaskDetail);
    expect(back1.breadcrumbs).toEqual([ViewType.TaskList, ViewType.TaskDetail]);

    const back2 = appReducer(back1, { type: 'GO_BACK' });
    expect(back2.activeView).toBe(ViewType.TaskList);
  });

  it('SET_TASKS updates tasks and clamps selectedIndex', () => {
    const withIndex = { ...initialState, selectedIndex: 5 };
    const state = appReducer(withIndex, {
      type: 'SET_TASKS',
      tasks: [mockTask, { ...mockTask, id: 'task-2' }],
    });
    expect(state.tasks).toHaveLength(2);
    expect(state.selectedIndex).toBe(1);
  });

  it('SET_TASKS handles empty array', () => {
    const state = appReducer(initialState, { type: 'SET_TASKS', tasks: [] });
    expect(state.tasks).toHaveLength(0);
    expect(state.selectedIndex).toBe(0);
  });

  it('MOVE_CURSOR up/down respects bounds', () => {
    const withTasks = appReducer(initialState, {
      type: 'SET_TASKS',
      tasks: [mockTask, { ...mockTask, id: 'task-2' }, { ...mockTask, id: 'task-3' }],
    });

    const down1 = appReducer(withTasks, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down1.selectedIndex).toBe(1);

    const down2 = appReducer(down1, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down2.selectedIndex).toBe(2);

    const down3 = appReducer(down2, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down3.selectedIndex).toBe(2);

    const up = appReducer(down2, { type: 'MOVE_CURSOR', direction: 'up' });
    expect(up.selectedIndex).toBe(1);

    const upFromZero = appReducer(withTasks, { type: 'MOVE_CURSOR', direction: 'up' });
    expect(upFromZero.selectedIndex).toBe(0);
  });

  describe('PAGE_CURSOR', () => {
    // Build a list of 25 tasks for paging tests (PAGE_SIZE = 20)
    const manyTasks = Array.from({ length: 25 }, (_, i) => ({
      ...mockTask,
      id: `task-${i + 1}`,
      name: `Task ${i + 1}`,
      rank: (i + 1) * 1000,
    }));

    it('page down moves cursor by PAGE_SIZE', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'down' });
      expect(state.selectedIndex).toBe(20);
    });

    it('page down clamps to last item', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      // Move near end, then page down
      state = { ...state, selectedIndex: 22 };
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'down' });
      expect(state.selectedIndex).toBe(24); // last index
    });

    it('page up moves cursor by PAGE_SIZE', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      state = { ...state, selectedIndex: 22 };
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'up' });
      expect(state.selectedIndex).toBe(2);
    });

    it('page up clamps to 0', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      state = { ...state, selectedIndex: 5 };
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'up' });
      expect(state.selectedIndex).toBe(0);
    });

    it('page down is no-op on empty list', () => {
      const state = appReducer(initialState, { type: 'PAGE_CURSOR', direction: 'down' });
      expect(state.selectedIndex).toBe(0);
    });

    it('page up from 0 stays at 0', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'up' });
      expect(state.selectedIndex).toBe(0);
    });

    it('resets detailScrollOffset', () => {
      let state = appReducer(initialState, { type: 'SET_TASKS', tasks: manyTasks });
      state = { ...state, detailScrollOffset: 10 };
      state = appReducer(state, { type: 'PAGE_CURSOR', direction: 'down' });
      expect(state.detailScrollOffset).toBe(0);
    });
  });

  it('SET_FILTER merges filter and resets cursor', () => {
    const withIndex = { ...initialState, selectedIndex: 3 };
    const state = appReducer(withIndex, {
      type: 'SET_FILTER',
      filter: { status: 'todo' },
    });
    expect(state.filter.status).toBe('todo');
    expect(state.selectedIndex).toBe(0);
  });

  it('SET_FILTER preserves other filter fields', () => {
    const withFilter = appReducer(initialState, {
      type: 'SET_FILTER',
      filter: { status: 'todo', type: 'bug' },
    });
    const updated = appReducer(withFilter, {
      type: 'SET_FILTER',
      filter: { search: 'test' },
    });
    expect(updated.filter.status).toBe('todo');
    expect(updated.filter.type).toBe('bug');
    expect(updated.filter.search).toBe('test');
  });

  it('CLEAR_FILTER resets to empty filter', () => {
    const withFilter = appReducer(initialState, {
      type: 'SET_FILTER',
      filter: { status: 'todo', type: 'bug', search: 'hello' },
    });
    const cleared = appReducer(withFilter, { type: 'CLEAR_FILTER' });
    expect(cleared.filter).toEqual({});
    expect(cleared.searchQuery).toBe('');
  });

  it('FLASH and CLEAR_FLASH', () => {
    const state = appReducer(initialState, {
      type: 'FLASH',
      message: 'Task created',
      level: 'info',
    });
    expect(state.flash).toEqual({ message: 'Task created', level: 'info' });

    const cleared = appReducer(state, { type: 'CLEAR_FLASH' });
    expect(cleared.flash).toBeNull();
  });

  it('FLASH supports error level', () => {
    const state = appReducer(initialState, {
      type: 'FLASH',
      message: 'Not found',
      level: 'error',
    });
    expect(state.flash?.level).toBe('error');
  });

  it('CONFIRM_DELETE and CANCEL_DELETE', () => {
    const state = appReducer(initialState, {
      type: 'CONFIRM_DELETE',
      task: mockTask,
    });
    expect(state.confirmDelete).toBe(mockTask);

    const cancelled = appReducer(state, { type: 'CANCEL_DELETE' });
    expect(cancelled.confirmDelete).toBeNull();
  });

  it('SET_SEARCH_ACTIVE and SET_SEARCH_QUERY', () => {
    const active = appReducer(initialState, {
      type: 'SET_SEARCH_ACTIVE',
      active: true,
    });
    expect(active.isSearchActive).toBe(true);

    const withQuery = appReducer(active, {
      type: 'SET_SEARCH_QUERY',
      query: 'login',
    });
    expect(withQuery.searchQuery).toBe('login');
  });

  it('SELECT_TASK stores the selected task', () => {
    const state = appReducer(initialState, {
      type: 'SELECT_TASK',
      task: mockTask,
    });
    expect(state.selectedTask).toBe(mockTask);
  });

  it('NAVIGATE_TO clears confirmDelete', () => {
    const withConfirm = appReducer(initialState, {
      type: 'CONFIRM_DELETE',
      task: mockTask,
    });
    const navigated = appReducer(withConfirm, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskCreate,
    });
    expect(navigated.confirmDelete).toBeNull();
  });

  it('GO_BACK clears form data and search', () => {
    let state = appReducer(initialState, {
      type: 'SET_SEARCH_ACTIVE',
      active: true,
    });
    state = appReducer(state, {
      type: 'SET_FORM_DATA',
      data: { name: 'test' },
    });
    const back = appReducer(state, { type: 'GO_BACK' });
    expect(back.isSearchActive).toBe(false);
    expect(back.formData).toBeNull();
  });

  describe('Reorder', () => {
    it('ENTER_REORDER enables reorder mode and takes snapshot', () => {
      const withTasks = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, { ...mockTask, id: 'task-2', rank: 2000 }],
      });
      const state = appReducer(withTasks, { type: 'ENTER_REORDER' });
      expect(state.isReordering).toBe(true);
      expect(state.reorderSnapshot).toHaveLength(2);
    });

    it('REORDER_MOVE swaps tasks and moves cursor', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });

      // Move down: swap task-1 and task-2
      const moved = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });
      expect(moved.selectedIndex).toBe(1);
      expect(moved.tasks[0]?.id).toBe('task-2');
      expect(moved.tasks[1]?.id).toBe('task-1');
    });

    it('REORDER_MOVE does nothing at boundaries', () => {
      const state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask],
      });
      const reordering = appReducer(state, { type: 'ENTER_REORDER' });

      const movedUp = appReducer(reordering, { type: 'REORDER_MOVE', direction: 'up' });
      expect(movedUp.selectedIndex).toBe(0);

      const movedDown = appReducer(reordering, { type: 'REORDER_MOVE', direction: 'down' });
      expect(movedDown.selectedIndex).toBe(0);
    });

    it('EXIT_REORDER with save=false reverts to snapshot', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });
      state = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });

      const reverted = appReducer(state, { type: 'EXIT_REORDER', save: false });
      expect(reverted.isReordering).toBe(false);
      expect(reverted.tasks[0]?.id).toBe('task-1');
    });

    it('EXIT_REORDER with save=true keeps new order', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });
      state = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });

      const saved = appReducer(state, { type: 'EXIT_REORDER', save: true });
      expect(saved.isReordering).toBe(false);
      expect(saved.tasks[0]?.id).toBe('task-2');
      expect(saved.reorderSnapshot).toBeNull();
    });

    it('REORDER_MOVE is no-op when not reordering', () => {
      const state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, { ...mockTask, id: 'task-2', rank: 2000 }],
      });
      const moved = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });
      expect(moved.tasks[0]?.id).toBe('task-1');
    });
  });

  describe('Dependency state', () => {
    const mockTask2: Task = {
      ...mockTask,
      id: 'task-2',
      name: 'Task 2',
    };
    const mockTask3: Task = {
      ...mockTask,
      id: 'task-3',
      name: 'Task 3',
    };
    const mockTask4: Task = {
      ...mockTask,
      id: 'task-4',
      name: 'Task 4',
    };

    describe('SET_DEPS', () => {
      it('sets all dependency lists and resets cursor', () => {
        const state = appReducer(
          { ...initialState, depSelectedIndex: 5 },
          {
            type: 'SET_DEPS',
            blockers: [mockTask],
            dependents: [mockTask2],
            related: [mockTask3],
            duplicates: [mockTask4],
          },
        );
        expect(state.depBlockers).toEqual([mockTask]);
        expect(state.depDependents).toEqual([mockTask2]);
        expect(state.depRelated).toEqual([mockTask3]);
        expect(state.depDuplicates).toEqual([mockTask4]);
        expect(state.depSelectedIndex).toBe(0);
      });

      it('handles empty dependency lists', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [],
          dependents: [],
          related: [],
          duplicates: [],
        });
        expect(state.depBlockers).toHaveLength(0);
        expect(state.depDependents).toHaveLength(0);
        expect(state.depRelated).toHaveLength(0);
        expect(state.depDuplicates).toHaveLength(0);
        expect(state.depSelectedIndex).toBe(0);
      });

      it('replaces existing dependency lists', () => {
        let state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask],
          dependents: [mockTask2],
          related: [],
          duplicates: [],
        });
        state = appReducer(state, {
          type: 'SET_DEPS',
          blockers: [mockTask3],
          dependents: [],
          related: [mockTask4],
          duplicates: [],
        });
        expect(state.depBlockers).toEqual([mockTask3]);
        expect(state.depDependents).toHaveLength(0);
        expect(state.depRelated).toEqual([mockTask4]);
      });
    });

    describe('DEP_MOVE_CURSOR', () => {
      it('moves cursor down within bounds', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask, mockTask2],
          dependents: [mockTask3],
          related: [],
          duplicates: [],
        });
        // Total = 3 items, cursor at 0
        const moved = appReducer(state, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        expect(moved.depSelectedIndex).toBe(1);
      });

      it('moves cursor up within bounds', () => {
        let state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask, mockTask2],
          dependents: [mockTask3],
          related: [],
          duplicates: [],
        });
        state = { ...state, depSelectedIndex: 2 };
        const moved = appReducer(state, { type: 'DEP_MOVE_CURSOR', direction: 'up' });
        expect(moved.depSelectedIndex).toBe(1);
      });

      it('does not go below 0', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask],
          dependents: [],
          related: [],
          duplicates: [],
        });
        const moved = appReducer(state, { type: 'DEP_MOVE_CURSOR', direction: 'up' });
        expect(moved.depSelectedIndex).toBe(0);
      });

      it('does not exceed total item count', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask],
          dependents: [mockTask2],
          related: [],
          duplicates: [],
        });
        // Total = 2, max index = 1
        let moved = appReducer(state, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        moved = appReducer(moved, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        expect(moved.depSelectedIndex).toBe(1);
      });

      it('is no-op when all dependency lists are empty', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [],
          dependents: [],
          related: [],
          duplicates: [],
        });
        const moved = appReducer(state, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        expect(moved.depSelectedIndex).toBe(0);
      });

      it('counts items across all four lists for bounds', () => {
        const state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask],
          dependents: [mockTask2],
          related: [mockTask3],
          duplicates: [mockTask4],
        });
        // Total = 4, max index = 3
        let moved = state;
        moved = appReducer(moved, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        moved = appReducer(moved, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        moved = appReducer(moved, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        expect(moved.depSelectedIndex).toBe(3);
        // Cannot go further
        moved = appReducer(moved, { type: 'DEP_MOVE_CURSOR', direction: 'down' });
        expect(moved.depSelectedIndex).toBe(3);
      });
    });

    describe('SET_ADDING_DEP', () => {
      it('enables adding dep mode and clears input', () => {
        const state = appReducer(
          { ...initialState, addDepInput: 'leftover' },
          { type: 'SET_ADDING_DEP', active: true },
        );
        expect(state.isAddingDep).toBe(true);
        expect(state.addDepInput).toBe('');
      });

      it('disables adding dep mode and clears input', () => {
        let state = appReducer(initialState, { type: 'SET_ADDING_DEP', active: true });
        state = appReducer(state, { type: 'SET_ADD_DEP_INPUT', input: 'TASK-123' });
        state = appReducer(state, { type: 'SET_ADDING_DEP', active: false });
        expect(state.isAddingDep).toBe(false);
        expect(state.addDepInput).toBe('');
      });
    });

    describe('SET_ADD_DEP_INPUT', () => {
      it('updates the dependency input text', () => {
        const state = appReducer(initialState, {
          type: 'SET_ADD_DEP_INPUT',
          input: 'TASK-456',
        });
        expect(state.addDepInput).toBe('TASK-456');
      });

      it('handles input with type suffix', () => {
        const state = appReducer(initialState, {
          type: 'SET_ADD_DEP_INPUT',
          input: 'TASK-789:relates-to',
        });
        expect(state.addDepInput).toBe('TASK-789:relates-to');
      });

      it('handles empty input', () => {
        const state = appReducer(
          { ...initialState, addDepInput: 'previous' },
          { type: 'SET_ADD_DEP_INPUT', input: '' },
        );
        expect(state.addDepInput).toBe('');
      });
    });

    describe('navigation clears dependency state', () => {
      it('NAVIGATE_TO DependencyList preserves dep state', () => {
        let state = appReducer(initialState, {
          type: 'SET_DEPS',
          blockers: [mockTask],
          dependents: [],
          related: [],
          duplicates: [],
        });
        state = appReducer(state, {
          type: 'NAVIGATE_TO',
          view: ViewType.DependencyList,
        });
        // Dep state is preserved across navigation
        expect(state.depBlockers).toEqual([mockTask]);
        expect(state.activeView).toBe(ViewType.DependencyList);
      });
    });
  });

  describe('Epic panel state', () => {
    const epicTask: Task = {
      ...mockTask,
      id: 'epic-1',
      type: 'epic',
      name: 'Epic 1',
    };
    const epicTask2: Task = {
      ...mockTask,
      id: 'epic-2',
      type: 'epic',
      name: 'Epic 2',
    };

    it('SET_EPICS stores epics and clamps cursor', () => {
      const withIndex = { ...initialState, epicSelectedIndex: 5 };
      const state = appReducer(withIndex, {
        type: 'SET_EPICS',
        epics: [epicTask, epicTask2],
      });
      expect(state.epics).toHaveLength(2);
      expect(state.epicSelectedIndex).toBe(1); // clamped from 5 to max 1
    });

    it('EPIC_MOVE_CURSOR moves within bounds', () => {
      let state = appReducer(initialState, {
        type: 'SET_EPICS',
        epics: [epicTask, epicTask2],
      });
      state = appReducer(state, { type: 'EPIC_MOVE_CURSOR', direction: 'down' });
      expect(state.epicSelectedIndex).toBe(1);

      // Can't go past end
      state = appReducer(state, { type: 'EPIC_MOVE_CURSOR', direction: 'down' });
      expect(state.epicSelectedIndex).toBe(1);

      // Go back up
      state = appReducer(state, { type: 'EPIC_MOVE_CURSOR', direction: 'up' });
      expect(state.epicSelectedIndex).toBe(0);

      // Can't go before 0
      state = appReducer(state, { type: 'EPIC_MOVE_CURSOR', direction: 'up' });
      expect(state.epicSelectedIndex).toBe(0);
    });

    it('EPIC_MOVE_CURSOR is no-op when empty', () => {
      const state = appReducer(initialState, { type: 'EPIC_MOVE_CURSOR', direction: 'down' });
      expect(state.epicSelectedIndex).toBe(0);
    });

    it('TOGGLE_EPIC adds and removes epic from selection', () => {
      let state = appReducer(initialState, {
        type: 'SET_EPICS',
        epics: [epicTask, epicTask2],
      });

      // Select epic-1
      state = appReducer(state, { type: 'TOGGLE_EPIC', epicId: 'epic-1' });
      expect(state.selectedEpicIds.has('epic-1')).toBe(true);
      expect(state.selectedEpicIds.size).toBe(1);
      expect(state.selectedIndex).toBe(0); // resets task cursor

      // Also select epic-2
      state = appReducer(state, { type: 'TOGGLE_EPIC', epicId: 'epic-2' });
      expect(state.selectedEpicIds.size).toBe(2);

      // Deselect epic-1
      state = appReducer(state, { type: 'TOGGLE_EPIC', epicId: 'epic-1' });
      expect(state.selectedEpicIds.has('epic-1')).toBe(false);
      expect(state.selectedEpicIds.size).toBe(1);
    });

    it('CLEAR_EPIC_SELECTION removes all selections', () => {
      let state = appReducer(initialState, { type: 'TOGGLE_EPIC', epicId: 'epic-1' });
      state = appReducer(state, { type: 'TOGGLE_EPIC', epicId: 'epic-2' });
      expect(state.selectedEpicIds.size).toBe(2);

      state = appReducer(state, { type: 'CLEAR_EPIC_SELECTION' });
      expect(state.selectedEpicIds.size).toBe(0);
      expect(state.selectedIndex).toBe(0);
    });

    it('initialState has empty epic state', () => {
      expect(initialState.epics).toEqual([]);
      expect(initialState.epicSelectedIndex).toBe(0);
      expect(initialState.selectedEpicIds.size).toBe(0);
    });

    it('panel focus includes epic option', () => {
      const state = appReducer(initialState, {
        type: 'SET_PANEL_FOCUS',
        panel: 'epic',
      });
      expect(state.focusedPanel).toBe('epic');
    });
  });

  describe('EpicPicker navigation', () => {
    it('NAVIGATE_TO EpicPicker pushes breadcrumb', () => {
      const state = appReducer(initialState, {
        type: 'NAVIGATE_TO',
        view: ViewType.EpicPicker,
      });
      expect(state.activeView).toBe(ViewType.EpicPicker);
      expect(state.breadcrumbs).toEqual([ViewType.TaskList, ViewType.EpicPicker]);
    });

    it('GO_BACK from EpicPicker returns to TaskList', () => {
      let state = appReducer(initialState, {
        type: 'NAVIGATE_TO',
        view: ViewType.EpicPicker,
      });
      state = appReducer(state, { type: 'GO_BACK' });
      expect(state.activeView).toBe(ViewType.TaskList);
    });
  });

  describe('SET_EDITING_PROJECT', () => {
    const mockProject: Project = {
      id: 'proj-1',
      key: 'MYA',
      name: 'My App',
      description: 'Main application',
      isDefault: true,
      gitRemote: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('sets editingProject', () => {
      const state = appReducer(initialState, {
        type: 'SET_EDITING_PROJECT',
        project: mockProject,
      });
      expect(state.editingProject).toEqual(mockProject);
    });

    it('clears editingProject when set to null', () => {
      let state = appReducer(initialState, {
        type: 'SET_EDITING_PROJECT',
        project: mockProject,
      });
      state = appReducer(state, { type: 'SET_EDITING_PROJECT', project: null });
      expect(state.editingProject).toBeNull();
    });

    it('GO_BACK clears editingProject', () => {
      let state = appReducer(initialState, {
        type: 'SET_EDITING_PROJECT',
        project: mockProject,
      });
      state = appReducer(state, { type: 'NAVIGATE_TO', view: ViewType.ProjectEdit });
      state = appReducer(state, { type: 'GO_BACK' });
      expect(state.editingProject).toBeNull();
    });
  });

  describe('changelog banner actions', () => {
    const mockEntries = [
      {
        version: '0.7.0',
        date: '2026-04-12',
        sections: [{ heading: 'Added', items: ['New feature'] }],
      },
      {
        version: '0.6.0',
        date: '2026-04-10',
        sections: [{ heading: 'Fixed', items: ['Bug fix'] }],
      },
    ];

    it('initialState has null changelogEntries and index 0', () => {
      expect(initialState.changelogEntries).toBeNull();
      expect(initialState.changelogIndex).toBe(0);
    });

    it('SET_CHANGELOG sets entries and resets index to 0', () => {
      const state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      expect(state.changelogEntries).toEqual(mockEntries);
      expect(state.changelogIndex).toBe(0);
    });

    it('SET_CHANGELOG with null clears entries', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'SET_CHANGELOG', entries: null });
      expect(state.changelogEntries).toBeNull();
    });

    it('CHANGELOG_NAVIGATE down increments index', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      expect(state.changelogIndex).toBe(1);
    });

    it('CHANGELOG_NAVIGATE down clamps at last entry', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      expect(state.changelogIndex).toBe(1); // clamped at max (1)
    });

    it('CHANGELOG_NAVIGATE up clamps at 0', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'up' });
      expect(state.changelogIndex).toBe(0);
    });

    it('CHANGELOG_NAVIGATE up decrements index', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'up' });
      expect(state.changelogIndex).toBe(0);
    });

    it('CHANGELOG_NAVIGATE is a no-op when entries is null', () => {
      const state = appReducer(initialState, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      expect(state.changelogIndex).toBe(0);
    });

    it('DISMISS_CHANGELOG clears entries, resets index, and closes dialog', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'OPEN_CHANGELOG_DIALOG' });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      state = appReducer(state, { type: 'DISMISS_CHANGELOG' });
      expect(state.changelogEntries).toBeNull();
      expect(state.changelogIndex).toBe(0);
      expect(state.changelogDialogOpen).toBe(false);
    });

    it('initialState has changelogDialogOpen=false', () => {
      expect(initialState.changelogDialogOpen).toBe(false);
    });

    it('OPEN_CHANGELOG_DIALOG sets changelogDialogOpen=true and resets index', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'CHANGELOG_NAVIGATE', direction: 'down' });
      state = appReducer(state, { type: 'OPEN_CHANGELOG_DIALOG' });
      expect(state.changelogDialogOpen).toBe(true);
      expect(state.changelogIndex).toBe(0);
    });

    it('CLOSE_CHANGELOG_DIALOG closes dialog but preserves entries', () => {
      let state = appReducer(initialState, { type: 'SET_CHANGELOG', entries: mockEntries });
      state = appReducer(state, { type: 'OPEN_CHANGELOG_DIALOG' });
      state = appReducer(state, { type: 'CLOSE_CHANGELOG_DIALOG' });
      expect(state.changelogDialogOpen).toBe(false);
      expect(state.changelogEntries).toEqual(mockEntries);
    });
  });
});
