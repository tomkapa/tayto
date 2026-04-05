import { z } from 'zod/v4';
import { TaskStatus, TaskType, DependencyType, UIDependencyType } from './enums.js';

const taskStatusValues = Object.values(TaskStatus) as [string, ...string[]];
const taskTypeValues = Object.values(TaskType) as [string, ...string[]];
const uiDepTypeValues = Object.values(UIDependencyType) as [string, ...string[]];

const DependencyEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(uiDepTypeValues).default(DependencyType.Blocks),
});
export type DependencyEntry = z.infer<typeof DependencyEntrySchema>;

export const CreateTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).default(TaskType.Story),
  status: z.enum(taskStatusValues).default(TaskStatus.Backlog),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
  dependsOn: z.array(DependencyEntrySchema).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).optional(),
  status: z.enum(taskStatusValues).optional(),
  parentId: z.string().nullable().optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
  appendNotes: z.string().max(50000).optional(),
  appendRequirements: z.string().max(50000).optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskFilterSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(taskStatusValues).optional(),
  type: z.enum(taskTypeValues).optional(),
  level: z.number().int().min(1).max(2).optional(),
  parentId: z.string().optional(),
  /** Multi-select filter: show tasks whose parentId is in this list. */
  parentIds: z.array(z.string()).optional(),
  search: z.string().optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

export const RerankTaskSchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
  afterId: z.string().optional(),
  beforeId: z.string().optional(),
  position: z.number().int().min(1).optional(),
});
export type RerankTaskInput = z.infer<typeof RerankTaskSchema>;

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  rank: number;
  technicalNotes: string;
  additionalRequirements: string;
  createdAt: string;
  updatedAt: string;
}
