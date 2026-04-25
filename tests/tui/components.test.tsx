import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import type { Task } from '../../src/types/task.js';
import type { Project } from '../../src/types/project.js';
import { GitRemote } from '../../src/types/git-remote.js';
import { TaskList } from '../../src/tui/components/TaskList.js';
import { TaskDetail } from '../../src/tui/components/TaskDetail.js';
import { TaskForm } from '../../src/tui/components/TaskForm.js';
import { TaskPicker } from '../../src/tui/components/TaskPicker.js';
import { ProjectForm } from '../../src/tui/components/ProjectForm.js';
import { ProjectLinkForm } from '../../src/tui/components/ProjectLinkForm.js';
import { ProjectSelector } from '../../src/tui/components/ProjectSelector.js';
import { Header } from '../../src/tui/components/Header.js';
import { Crumbs } from '../../src/tui/components/Crumbs.js';
import { FlashMessage } from '../../src/tui/components/FlashMessage.js';
import { HelpOverlay } from '../../src/tui/components/HelpOverlay.js';
import { ConfirmDialog } from '../../src/tui/components/ConfirmDialog.js';
import { DetectedProjectDialog } from '../../src/tui/components/DetectedProjectDialog.js';
import { Markdown } from '../../src/tui/components/Markdown.js';
import { StatusBadge, TypeBadge } from '../../src/tui/components/Badges.js';
import { TabBar } from '../../src/tui/components/TabBar.js';
import { SettingsView } from '../../src/tui/components/SettingsView.js';
import { initialState } from '../../src/tui/state.js';
import { ViewType, TopTab } from '../../src/tui/types.js';

const mockTask: Task = {
  id: '01ABC123',
  projectId: 'proj-1',
  parentId: null,
  name: 'Fix login bug',
  description: 'Login fails on **mobile** devices',
  type: 'bug',
  status: 'in-progress',
  rank: 1000,
  technicalNotes: '## Root cause\nJWT token expiry not checked',
  additionalRequirements: 'Must work on iOS Safari',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
};

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

// ANSI escape sequences for arrow keys
const ARROW_UP = '\x1B[A';
const ARROW_DOWN = '\x1B[B';
const ARROW_RIGHT = '\x1B[C';
const ARROW_LEFT = '\x1B[D';
const BACKSPACE = '\x7F';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('TUI Component Rendering', () => {
  afterEach(cleanup);

  describe('Badges', () => {
    it('renders StatusBadge without crashing', () => {
      const { lastFrame } = render(<StatusBadge status="in-progress" />);
      expect(lastFrame()).toContain('IN-PROG');
    });

    it('renders TypeBadge without crashing', () => {
      const { lastFrame } = render(<TypeBadge type="bug" />);
      expect(lastFrame()).toContain('bug');
    });
  });

  describe('Markdown', () => {
    it('renders markdown content', () => {
      const { lastFrame } = render(<Markdown content="Hello **world**" />);
      expect(lastFrame()).toBeTruthy();
    });

    it('renders empty content gracefully', () => {
      const { lastFrame } = render(<Markdown content="" />);
      expect(lastFrame()).toContain('No content');
    });

    it('renders whitespace-only content as empty', () => {
      const { lastFrame } = render(<Markdown content="   " />);
      expect(lastFrame()).toContain('No content');
    });

    it('renders code blocks', () => {
      const md = '```typescript\nconst x = 1;\n```';
      const { lastFrame } = render(<Markdown content={md} />);
      expect(lastFrame()).toContain('const x = 1');
    });

    it('renders mermaid blocks with diagram label', () => {
      const md = '```mermaid\ngraph TD\n    A --> B\n```';
      const { lastFrame } = render(<Markdown content={md} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Mermaid Diagram');
      expect(frame).toContain('A --> B');
    });

    it('renders headings and lists', () => {
      const md = '# Title\n\n- item one\n- item two';
      const { lastFrame } = render(<Markdown content={md} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Title');
      expect(frame).toContain('item one');
    });
  });

  describe('TaskList', () => {
    it('renders with tasks', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('tasks');
      expect(frame).toContain('My App');
    });

    it('renders empty state', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      expect(lastFrame()).toContain('No tasks found');
    });

    it('renders search bar when active', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery="login"
          isSearchActive={true}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      expect(lastFrame()).toContain('login');
    });

    it('renders filter in title bar', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{ status: 'todo', type: 'bug' }}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('status:todo');
      expect(frame).toContain('type:bug');
    });

    it('renders multiple tasks with selection indicator', () => {
      const tasks = [
        mockTask,
        {
          ...mockTask,
          id: 'task-2',
          name: 'Add dashboard',
          type: 'story' as const,
          status: 'todo' as const,
          rank: 2000,
        },
      ];
      const { lastFrame } = render(
        <TaskList
          tasks={tasks}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('Add dashboard');
    });

    it('renders reorder indicator when reordering', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={true}
          filter={{}}
          activeProjectName="My App"
          nonTerminalBlockerIds={new Set()}
          nonTerminalDependentIds={new Set()}
          isSelectedBlocked={false}
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('REORDER');
    });
  });

  describe('TaskDetail', () => {
    it('renders task details with all fields', () => {
      const { lastFrame } = render(<TaskDetail task={mockTask} />);
      const frame = lastFrame();
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('detail');
    });

    it('renders task without optional fields', () => {
      const minimalTask: Task = {
        ...mockTask,
        technicalNotes: '',
        additionalRequirements: '',
        parentId: null,
      };
      const { lastFrame } = render(<TaskDetail task={minimalTask} />);
      expect(lastFrame()).toContain('Fix login bug');
    });

    it('renders task with parent id', () => {
      const childTask = { ...mockTask, parentId: 'parent-123' };
      const { lastFrame } = render(<TaskDetail task={childTask} />);
      expect(lastFrame()).toContain('parent');
    });

    it('renders YAML-style metadata', () => {
      const { lastFrame } = render(<TaskDetail task={mockTask} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('type');
      expect(frame).toContain('status');
    });

    it('renders blockers and dependents in dependencies section', () => {
      const blocker: Task = { ...mockTask, id: 'T-010', name: 'Blocker task' };
      const dependent: Task = { ...mockTask, id: 'T-011', name: 'Dependent task' };
      const { lastFrame } = render(
        <TaskDetail task={mockTask} blockers={[blocker]} dependents={[dependent]} />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('blocked by');
      expect(frame).toContain('T-010');
      expect(frame).toContain('blocks');
      expect(frame).toContain('T-011');
    });

    it('renders relates-to dependencies', () => {
      // Regression: TaskDetail previously only accepted blockers/dependents,
      // so relates-to tasks were never shown in the detail view.
      const related: Task = { ...mockTask, id: 'T-020', name: 'Related task' };
      const { lastFrame } = render(<TaskDetail task={mockTask} related={[related]} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('relates to');
      expect(frame).toContain('T-020');
    });

    it('renders duplicates dependencies', () => {
      // Regression: TaskDetail previously only accepted blockers/dependents,
      // so duplicates tasks were never shown in the detail view.
      const dup: Task = { ...mockTask, id: 'T-030', name: 'Duplicate task' };
      const { lastFrame } = render(<TaskDetail task={mockTask} duplicates={[dup]} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('duplicates');
      expect(frame).toContain('T-030');
    });

    it('shows dependencies section only when at least one dep type is present', () => {
      const { lastFrame } = render(<TaskDetail task={mockTask} />);
      expect(lastFrame()).not.toContain('--- dependencies ---');

      const related: Task = { ...mockTask, id: 'T-040', name: 'Related' };
      const { lastFrame: withDeps } = render(<TaskDetail task={mockTask} related={[related]} />);
      expect(withDeps()).toContain('--- dependencies ---');
    });

    it('renders task name as a field, not in the title bar', () => {
      // Regression: long task names previously rendered inside `detail(<name>)`
      // and wrapped onto two visual lines, overlapping the `id` row.
      // The title bar must contain only the static `detail` header; the
      // task name belongs to a `name:` field row alongside id/type/status.
      const longName = 'A very long task name that would wrap and overlap the id row in the panel';
      const longTask: Task = { ...mockTask, name: longName };
      const { lastFrame } = render(<TaskDetail task={longTask} />);
      const frame = lastFrame() ?? '';

      expect(frame).toContain('detail');
      expect(frame).toContain(longName);
      expect(frame).not.toContain(`detail(${longName})`);
      expect(frame).not.toMatch(/detail\s*\(/);
      expect(frame).toMatch(/name\s*:\s*A very long task name/);
    });
  });

  describe('TaskForm', () => {
    it('renders create form', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('create');
      expect(frame).toContain('Name');
      expect(frame).toContain('Type');
      expect(frame).toContain('Status');
      expect(frame).toContain('ctrl+s: save');
      expect(frame).toContain('navigate');
    });

    it('renders edit form with existing data', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={mockTask} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('edit');
      expect(frame).toContain('Fix login bug');
    });

    it('shows $EDITOR hint for long text fields', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Description');
      expect(frame).toContain('Tech Notes');
      expect(frame).toContain('Requirements');
    });

    it('shows preview of existing editor content', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={mockTask} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Login fails');
    });

    it('pre-populates dependency field from initialDeps when editing', () => {
      // Regression: edit form previously always started with empty pickedDeps,
      // so existing dependencies were never shown in the Depends On field.
      const initialDeps = [{ id: 'T-099', name: 'Blocker task', type: 'blocks' }];
      const { lastFrame } = render(
        <TaskForm
          editingTask={mockTask}
          allTasks={[]}
          initialDeps={initialDeps}
          onSave={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('T-099');
    });

    it('shows empty dependency field when no initialDeps provided', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={mockTask} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      expect(lastFrame()).toContain('none');
    });

    it('moves focus down with down arrow from inline field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('> Type');
    });

    it('moves focus up with up arrow from select field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_UP);
      await delay(50);
      expect(lastFrame()).toContain('> Name');
    });

    it('moves cursor left in inline field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={mockTask} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      // Name is "Fix login bug", cursor at end. Move left 3 times.
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      const frame = lastFrame() ?? '';
      // Cursor _ should appear between "Fix login " and "bug"
      expect(frame).toContain('Fix login _bug');
    });

    it('inserts character at cursor position in inline field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write('abc');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write('X');
      await delay(50);
      // Cursor is after 'X', so rendered as "abX_c"
      expect(lastFrame()).toContain('abX_c');
    });

    it('backspace deletes at cursor position in inline field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write('abcd');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      // Backspace should delete 'c'
      stdin.write(BACKSPACE);
      await delay(50);
      expect(lastFrame()).toContain('ab_d');
    });

    it('up/down arrows navigate between select fields', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      expect(lastFrame()).toContain('> Status');
    });
  });

  describe('TaskForm keyboard navigation', () => {
    it('does not move cursor below 0', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write('X');
      await delay(50);
      expect(lastFrame()).toContain('X');
    });

    it('does not move focus above first field', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write(ARROW_UP);
      await delay(50);
      expect(lastFrame()).toContain('> Name');
    });

    it('backspace does nothing at cursor position 0', async () => {
      const { stdin, lastFrame } = render(
        <TaskForm editingTask={null} allTasks={[]} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      stdin.write('ab');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(BACKSPACE);
      await delay(50);
      expect(lastFrame()).toContain('ab');
    });
  });

  describe('ProjectForm initialGitRemote', () => {
    it('pre-fills Git Remote field when initialGitRemote is provided', async () => {
      const remote = GitRemote.parse('git@github.com:org/repo.git');
      const { lastFrame } = render(
        <ProjectForm initialGitRemote={remote} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      expect(lastFrame()).toContain('github.com/org/repo');
    });

    it('leaves Git Remote empty when initialGitRemote is not provided', async () => {
      const { lastFrame } = render(<ProjectForm onSave={() => {}} onCancel={() => {}} />);
      await delay(50);
      expect(lastFrame()).not.toContain('github.com');
    });
  });

  describe('ProjectForm keyboard navigation', () => {
    it('moves focus with up/down arrows', async () => {
      const { stdin, lastFrame } = render(<ProjectForm onSave={() => {}} onCancel={() => {}} />);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      expect(lastFrame()).toContain('> Key');
    });

    it('moves cursor left/right in inline field', async () => {
      const { stdin, lastFrame } = render(<ProjectForm onSave={() => {}} onCancel={() => {}} />);
      await delay(50);
      stdin.write('test');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write('XX');
      await delay(50);
      // Cursor is after XX: "teXX_st"
      expect(lastFrame()).toContain('teXX_st');
    });

    it('up/down arrows navigate toggle fields', async () => {
      const { stdin, lastFrame } = render(<ProjectForm onSave={() => {}} onCancel={() => {}} />);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      expect(lastFrame()).toContain('> Git Remote');
      stdin.write(ARROW_DOWN);
      await delay(50);
      expect(lastFrame()).toContain('> Default');
      stdin.write(ARROW_UP);
      await delay(50);
      expect(lastFrame()).toContain('> Git Remote');
    });

    it('includes gitRemote in save callback', async () => {
      const onSave = vi.fn();
      const { stdin } = render(<ProjectForm onSave={onSave} onCancel={() => {}} />);
      await delay(50);
      // Name field
      stdin.write('MyProject');
      await delay(50);
      // Navigate to Git Remote (3 downs: Key -> Description -> Git Remote)
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write(ARROW_DOWN);
      await delay(50);
      stdin.write('https://github.com/test/repo.git');
      await delay(50);
      // ctrl+s to save
      stdin.write('\x13');
      await delay(50);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'MyProject',
          gitRemote: 'https://github.com/test/repo.git',
        }),
      );
    });
  });

  describe('ProjectForm edit mode', () => {
    const editProject: Project = {
      id: 'proj-edit',
      key: 'EDT',
      name: 'Edit Me',
      description: 'A description',
      isDefault: false,
      gitRemote: GitRemote.parse('https://github.com/test/edit.git'),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    it('shows edit project title when editing', () => {
      const { lastFrame } = render(
        <ProjectForm editingProject={editProject} onSave={() => {}} onCancel={() => {}} />,
      );
      expect(lastFrame()).toContain('edit project');
    });

    it('pre-populates fields from editingProject', () => {
      const { lastFrame } = render(
        <ProjectForm editingProject={editProject} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Edit Me');
      expect(frame).toContain('EDT');
      expect(frame).toContain('A description');
      expect(frame).toContain('github.com/test/edit');
    });

    it('shows read-only hint on key field when editing', async () => {
      const { stdin, lastFrame } = render(
        <ProjectForm editingProject={editProject} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      // Navigate to Key field
      stdin.write(ARROW_DOWN);
      await delay(50);
      expect(lastFrame()).toContain('read-only');
    });

    it('does not modify key field when editing', async () => {
      const { stdin, lastFrame } = render(
        <ProjectForm editingProject={editProject} onSave={() => {}} onCancel={() => {}} />,
      );
      await delay(50);
      // Navigate to Key field
      stdin.write(ARROW_DOWN);
      await delay(50);
      // Try to type
      stdin.write('XYZ');
      await delay(50);
      // Key should remain unchanged
      expect(lastFrame()).toContain('EDT');
      expect(lastFrame()).not.toContain('EDTXYZ');
    });

    it('saves edited values via onSave callback', async () => {
      const onSave = vi.fn();
      const { stdin } = render(
        <ProjectForm editingProject={editProject} onSave={onSave} onCancel={() => {}} />,
      );
      await delay(50);
      // Edit name: clear and type new name
      // Select all text via repeated backspace
      for (let i = 0; i < 'Edit Me'.length; i++) {
        stdin.write(BACKSPACE);
        await delay(10);
      }
      stdin.write('Updated Name');
      await delay(50);
      // ctrl+s to save
      stdin.write('\x13');
      await delay(50);
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          key: 'EDT',
          description: 'A description',
          gitRemote: 'github.com/test/edit',
        }),
      );
    });
  });

  describe('ProjectSelector edit action', () => {
    it('calls onEdit when e is pressed', () => {
      const onEdit = vi.fn();
      const { stdin } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={null}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={onEdit}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      stdin.write('e');
      expect(onEdit).toHaveBeenCalledWith(mockProject);
    });

    it('shows edit hint text', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={mockProject}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('e: edit');
    });
  });

  describe('ProjectLinkForm cursor navigation', () => {
    it('moves cursor left/right and inserts at position', async () => {
      const { stdin, lastFrame } = render(
        <ProjectLinkForm
          project={mockProject}
          onSave={() => {}}
          onUnlink={() => {}}
          onDetect={() => null}
          onCancel={() => {}}
        />,
      );
      await delay(50);
      stdin.write('abcd');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write('X');
      await delay(50);
      // Cursor after X: "abX_cd"
      expect(lastFrame()).toContain('abX_cd');
    });

    it('backspace deletes at cursor position', async () => {
      const { stdin, lastFrame } = render(
        <ProjectLinkForm
          project={mockProject}
          onSave={() => {}}
          onUnlink={() => {}}
          onDetect={() => null}
          onCancel={() => {}}
        />,
      );
      await delay(50);
      stdin.write('abcd');
      await delay(50);
      stdin.write(ARROW_LEFT);
      await delay(50);
      stdin.write(BACKSPACE);
      await delay(50);
      // Cursor after deletion: "ab_d"
      expect(lastFrame()).toContain('ab_d');
    });
  });

  describe('TaskPicker', () => {
    const task1: Task = { ...mockTask, id: 'T-001', name: 'First task' };
    const task2: Task = {
      ...mockTask,
      id: 'T-002',
      name: 'Second task',
      status: 'todo',
    };

    it('renders available tasks', () => {
      const { lastFrame } = render(
        <TaskPicker tasks={[task1, task2]} onConfirm={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('First task');
      expect(frame).toContain('Second task');
    });

    it('renders all tasks passed in the tasks prop', () => {
      // This test guards against the bug where allProjectTasks was stale-memoized
      // in App.tsx and newly created tasks were not shown in the picker.
      // The picker must render whatever tasks it receives — if the prop is stale,
      // newly created tasks will be absent from the frame.
      const newlyCreated: Task = { ...mockTask, id: 'T-003', name: 'Newly created task' };
      const { lastFrame } = render(
        <TaskPicker
          tasks={[task1, task2, newlyCreated]}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('First task');
      expect(frame).toContain('Second task');
      expect(frame).toContain('Newly created task');
    });

    it('renders empty state when no tasks', () => {
      const { lastFrame } = render(
        <TaskPicker tasks={[]} onConfirm={() => {}} onCancel={() => {}} />,
      );
      expect(lastFrame()).toContain('No tasks match');
    });

    it('excludes tasks in excludeIds', () => {
      const { lastFrame } = render(
        <TaskPicker
          tasks={[task1, task2]}
          excludeIds={new Set([task1.id])}
          onConfirm={() => {}}
          onCancel={() => {}}
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).not.toContain('First task');
      expect(frame).toContain('Second task');
    });

    it('renders task ids in the picker', () => {
      const { lastFrame } = render(
        <TaskPicker tasks={[task1]} onConfirm={() => {}} onCancel={() => {}} />,
      );
      expect(lastFrame()).toContain('T-001');
    });
  });

  describe('ProjectSelector', () => {
    it('renders project list', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={mockProject}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('My App');
      expect(frame).toContain('projects');
    });

    it('renders empty state', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[]}
          activeProject={null}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('No projects');
    });

    it('shows D marker for default project', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={null}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('D');
    });

    it('shows set default hint text', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={mockProject}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={() => {}}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('set default');
    });

    it('calls onSetDefault when d is pressed', () => {
      const onSetDefault = vi.fn();
      const { stdin } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={null}
          onSelect={() => {}}
          onCreate={() => {}}
          onEdit={() => {}}
          onSetDefault={onSetDefault}
          onLink={() => {}}
          onCancel={() => {}}
        />,
      );
      stdin.write('d');
      expect(onSetDefault).toHaveBeenCalledWith(mockProject);
    });
  });

  describe('Header', () => {
    it('renders app info', () => {
      const state = { ...initialState, activeProject: mockProject, tasks: [mockTask] };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('tayto');
      expect(frame).toContain('My App');
      expect(frame).toContain('Project:');
    });

    it('renders key hints for task list', () => {
      const { lastFrame } = render(<Header state={initialState} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('create');
      expect(frame).toContain('help');
    });

    it('renders reorder hints when reordering', () => {
      const state = { ...initialState, isReordering: true };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('move');
      expect(frame).toContain('save');
      expect(frame).toContain('cancel');
    });

    it('renders epic reorder hints when epic reordering', () => {
      const state = { ...initialState, isReleaseReordering: true };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('move release');
      expect(frame).toContain('save');
      expect(frame).toContain('cancel');
    });

    it('renders dep-adding hints when adding dep', () => {
      const state = { ...initialState, isAddingDep: true };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('search');
      expect(frame).toContain('confirm');
      expect(frame).toContain('cancel');
    });

    it('renders search hints when search is active', () => {
      const state = { ...initialState, isSearchActive: true };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('query');
      expect(frame).toContain('apply');
      expect(frame).toContain('cancel');
    });

    it('renders detail panel hints when detail panel is focused', () => {
      const state = { ...initialState, focusedPanel: 'detail' as const };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('scroll');
      expect(frame).toContain('mermaid');
    });

    it('renders dep list hints on dependency-list view', () => {
      const state = { ...initialState, activeView: ViewType.DependencyList };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('add blocker');
      expect(frame).toContain('remove');
      expect(frame).toContain('goto task');
    });

    it('renders form hints on task create view', () => {
      const state = { ...initialState, activeView: ViewType.TaskCreate };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('navigate');
      expect(frame).toContain('cursor');
      expect(frame).toContain('save');
      expect(frame).toContain('cancel');
    });

    it('renders project selector hints', () => {
      const state = { ...initialState, activeView: ViewType.ProjectSelector };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('select');
      expect(frame).toContain('create');
      expect(frame).toContain('link');
    });

    it('shows shift+tab panel hint on task list', () => {
      const { lastFrame } = render(<Header state={initialState} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('S-tab');
    });

    it('renders settings hint on task list', () => {
      const { lastFrame } = render(<Header state={initialState} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('settings');
    });

    it('renders settings view hints', () => {
      const state = { ...initialState, activeView: ViewType.Settings };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('tasks');
      expect(frame).toContain('quit');
    });
  });

  describe('Crumbs', () => {
    it('renders breadcrumb trail', () => {
      const { lastFrame } = render(
        <Crumbs breadcrumbs={[ViewType.TaskList, ViewType.TaskDetail]} />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('tasks');
      expect(frame).toContain('detail');
    });

    it('renders single breadcrumb', () => {
      const { lastFrame } = render(<Crumbs breadcrumbs={[ViewType.TaskList]} />);
      expect(lastFrame()).toContain('tasks');
    });

    it('renders settings breadcrumb', () => {
      const { lastFrame } = render(<Crumbs breadcrumbs={[ViewType.Settings]} />);
      expect(lastFrame()).toContain('settings');
    });
  });

  describe('FlashMessage', () => {
    it('renders info flash', () => {
      const { lastFrame } = render(<FlashMessage message="Task created" level="info" />);
      expect(lastFrame()).toContain('Task created');
    });

    it('renders error flash', () => {
      const { lastFrame } = render(<FlashMessage message="Not found" level="error" />);
      expect(lastFrame()).toContain('Not found');
    });

    it('renders warning flash', () => {
      const { lastFrame } = render(<FlashMessage message="Careful" level="warn" />);
      expect(lastFrame()).toContain('Careful');
    });
  });

  describe('HelpOverlay', () => {
    it('renders all shortcut sections', () => {
      const { lastFrame } = render(<HelpOverlay />);
      const frame = lastFrame();
      expect(frame).toContain('Help');
      expect(frame).toContain('NAVIGATION');
      expect(frame).toContain('ACTIONS');
      expect(frame).toContain('REORDER');
      expect(frame).toContain('FILTER');
      expect(frame).toContain('RELEASE PANEL');
      expect(frame).toContain('DEPS VIEW');
      expect(frame).toContain('FORMS');
      expect(frame).toContain('GENERAL');
      expect(frame).toContain('Press any key to close');
    });

    it('includes assign/unassign and deps actions', () => {
      const { lastFrame } = render(<HelpOverlay />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Assign/unassign');
      expect(frame).toContain('Dependencies');
      expect(frame).toContain('Mermaid');
    });

    it('includes form shortcuts', () => {
      const { lastFrame } = render(<HelpOverlay />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('ctrl+s');
      expect(frame).toContain('Navigate fields');
      expect(frame).toContain('Move cursor');
      expect(frame).toContain('Open editor');
    });

    it('includes epic panel shortcuts', () => {
      const { lastFrame } = render(<HelpOverlay />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Toggle filter');
      expect(frame).toContain('Reorder releases');
    });
  });

  describe('ConfirmDialog', () => {
    it('renders delete confirmation with task name', () => {
      const { lastFrame } = render(<ConfirmDialog task={mockTask} />);
      const frame = lastFrame();
      expect(frame).toContain('Delete');
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('OK');
      expect(frame).toContain('Cancel');
    });
  });

  describe('TabBar', () => {
    it('renders both tabs', () => {
      const { lastFrame } = render(<TabBar activeTab={TopTab.Tasks} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Tasks');
      expect(frame).toContain('Settings');
    });

    it('renders with Tasks as active tab', () => {
      const { lastFrame } = render(<TabBar activeTab={TopTab.Tasks} />);
      expect(lastFrame()).toBeTruthy();
    });

    it('renders with Settings as active tab', () => {
      const { lastFrame } = render(<TabBar activeTab={TopTab.Settings} />);
      expect(lastFrame()).toBeTruthy();
    });
  });

  describe('SettingsView', () => {
    it('renders placeholder text', () => {
      const { lastFrame } = render(<SettingsView />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('settings');
      expect(frame).toContain('No settings available yet');
    });
  });

  describe('DetectedProjectDialog', () => {
    it('renders detected git remote with create and skip options', () => {
      const remote = GitRemote.parse('git@github.com:org/my-repo.git');
      const { lastFrame } = render(<DetectedProjectDialog remote={remote} />);
      const frame = lastFrame();
      expect(frame).toContain('New Repo Detected');
      expect(frame).toContain('github.com/org/my-repo');
      expect(frame).toContain('Create');
      expect(frame).toContain('Skip');
    });

    it('renders HTTPS remote in normalized form', () => {
      const remote = GitRemote.parse('https://github.com/acme/app.git');
      const { lastFrame } = render(<DetectedProjectDialog remote={remote} />);
      const frame = lastFrame();
      expect(frame).toContain('github.com/acme/app');
    });
  });
});
