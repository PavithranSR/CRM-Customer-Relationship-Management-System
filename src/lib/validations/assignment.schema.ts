import { z } from "zod";

export const assignEmployeeSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  userId: z.string().min(1, "Employee is required"),
  role: z.string().optional(),
  hoursAllocated: z.coerce.number().positive().optional(),
});

export const assignTeamSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  userIds: z.array(z.string()).min(1, "At least one employee is required"),
  role: z.string().optional(),
});

export type AssignEmployeeInput = z.infer<typeof assignEmployeeSchema>;
export type AssignTeamInput = z.infer<typeof assignTeamSchema>;
