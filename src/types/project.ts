import { z } from 'zod/v4';

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  key: z
    .string()
    .min(2, 'Project key must be at least 2 characters')
    .max(7, 'Project key must be at most 7 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Project key must contain only letters and digits')
    .transform((v) => v.toUpperCase())
    .optional(),
  description: z.string().max(5000).optional(),
  isDefault: z.boolean().optional(),
  gitRemote: z.string().min(1, 'Git remote URL must not be empty').nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  isDefault: z.boolean().optional(),
  gitRemote: z.string().min(1, 'Git remote URL must not be empty').nullable().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  isDefault: boolean;
  gitRemote: string | null;
  createdAt: string;
  updatedAt: string;
}
