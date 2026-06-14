import { z } from "zod";
import { Role } from "@prisma/client";
import {
  ACTION_PERMISSION_OPTIONS,
  FIELD_LEVEL_PERMISSION_OPTIONS,
  MODULE_ACCESS_OPTIONS,
  RECORD_RULE_OPTIONS,
} from "@/lib/employee-permissions";

const permissionsSchema = z.object({
  moduleAccess: z.array(z.enum(MODULE_ACCESS_OPTIONS)).default([]),
  recordRules: z.array(z.enum(RECORD_RULE_OPTIONS)).default([]),
  actionPermissions: z.array(z.enum(ACTION_PERMISSION_OPTIONS)).default([]),
  fieldLevelPermissions: z.array(z.enum(FIELD_LEVEL_PERMISSION_OPTIONS)).default([]),
  accessStartDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be a valid date")
    .nullable()
    .default(null),
  accessEndDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be a valid date")
    .nullable()
    .default(null),
}).refine(
  (permissions) =>
    !permissions.accessStartDate ||
    !permissions.accessEndDate ||
    permissions.accessStartDate < permissions.accessEndDate,
  {
    message: "End date must be after start date",
    path: ["accessEndDate"],
  }
);

export const createEmployeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  department: z.string().trim().min(1, "Department is required"),
  position: z.string().trim().min(1, "Position is required"),
  phone: z.string().optional(),
  hireDate: z.coerce.date().optional(),
  permissions: permissionsSchema,
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.nativeEnum(Role).optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
  hireDate: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
  permissions: permissionsSchema.optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
