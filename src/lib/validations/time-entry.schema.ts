import { z } from "zod";

export const createTimeEntrySchema = z.object({
  employeeId: z.string().optional(),
  projectId: z.string().min(1, "Project is required"),
  taskId: z.string().min(1, "Task is required"),
  date: z.coerce.date(),
  hours: z.coerce.number().positive("Hours must be positive").max(24, "Hours cannot exceed 24"),
  description: z.string().optional(),
  isBillable: z.boolean().default(true),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).default("DRAFT"),
});

export const updateTimeEntrySchema = z.object({
  employeeId: z.string().optional(),
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  date: z.coerce.date().optional(),
  hours: z.coerce.number().positive().max(24).optional(),
  description: z.string().optional(),
  isBillable: z.boolean().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "APPROVED"]).optional(),
});

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
