import { z } from "zod";
import { ProjectStatus, Priority, ProjectType } from "@prisma/client";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional(),
  code: z.string().max(20).optional(),
  clientId: z.string().optional(),
  serviceName: z.string().max(120).optional(),
  unitName: z.string().max(80).optional(),
  unitCount: z.coerce.number().int().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  costPerUnit: z.coerce.number().nonnegative().optional(),
  subtotalAmount: z.coerce.number().nonnegative().optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  gstAmount: z.coerce.number().nonnegative().optional(),
  finalAmount: z.coerce.number().nonnegative().optional(),
  profitAmount: z.coerce.number().optional(),
  invoicingPolicy: z.string().max(80).optional(),
  tags: z.string().max(200).optional(),
  expectedClosingDate: z.coerce.date().optional(),
  type: z.nativeEnum(ProjectType).default(ProjectType.INDIVIDUAL),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  estimatedHours: z.coerce.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().nullable().optional(),
  managerId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  serviceName: z.string().max(120).optional(),
  unitName: z.string().max(80).optional(),
  unitCount: z.coerce.number().int().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  costPerUnit: z.coerce.number().nonnegative().optional(),
  subtotalAmount: z.coerce.number().nonnegative().optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  gstAmount: z.coerce.number().nonnegative().optional(),
  finalAmount: z.coerce.number().nonnegative().optional(),
  profitAmount: z.coerce.number().optional(),
  invoicingPolicy: z.string().max(80).optional(),
  tags: z.string().max(200).optional(),
  expectedClosingDate: z.coerce.date().optional(),
  type: z.nativeEnum(ProjectType).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  progress: z.number().min(0).max(100).optional(),
  estimatedHours: z.coerce.number().positive().optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().nullable().optional(),
  managerId: z.string().optional(),
});

export const holdProjectSchema = z.object({
  reason: z.string().min(1, "Hold reason is required"),
});

export const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type HoldProjectInput = z.infer<typeof holdProjectSchema>;
