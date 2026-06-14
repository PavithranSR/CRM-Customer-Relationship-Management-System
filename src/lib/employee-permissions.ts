import type { Prisma, Role } from "@prisma/client";

export const MODULE_ACCESS_OPTIONS = ["CRM", "PROJECT", "SALES"] as const;
export const RECORD_RULE_OPTIONS = [
  "OWN_RECORD",
  "TEAM_RECORD",
  "ASSIGN_PROJECT",
  "RECORD_RULES",
] as const;
export const ACTION_PERMISSION_OPTIONS = [
  "CREATE",
  "EDIT",
  "DELETE",
  "UPDATE",
] as const;
export const FIELD_LEVEL_PERMISSION_OPTIONS = ["BUDGET", "PROFIT", "DISCOUNT"] as const;

export type ModuleAccessOption = (typeof MODULE_ACCESS_OPTIONS)[number];
export type RecordRuleOption = (typeof RECORD_RULE_OPTIONS)[number];
export type ActionPermissionOption = (typeof ACTION_PERMISSION_OPTIONS)[number];
export type FieldLevelPermissionOption = (typeof FIELD_LEVEL_PERMISSION_OPTIONS)[number];

export interface EmployeePermissions {
  moduleAccess: ModuleAccessOption[];
  recordRules: RecordRuleOption[];
  actionPermissions: ActionPermissionOption[];
  fieldLevelPermissions: FieldLevelPermissionOption[];
  accessStartDate: string | null;
  accessEndDate: string | null;
}

interface NormalizeEmployeePermissionsOptions {
  enforceAccessWindow?: boolean;
  now?: Date;
}

export type PermissionBucket =
  | "moduleAccess"
  | "recordRules"
  | "actionPermissions"
  | "fieldLevelPermissions";

const BUDGET_FIELD_KEYS = new Set<string>([
  "unitName",
  "unitCount",
  "unitPrice",
  "costPerUnit",
  "subtotalAmount",
  "gstPercent",
  "gstAmount",
  "finalAmount",
  "totalAmount",
  "amount",
  "balanceAmount",
  "quotationTotal",
  "paidAmount",
]);

const PROFIT_FIELD_KEYS = new Set<string>(["profitAmount"]);

const DISCOUNT_FIELD_KEYS = new Set<string>(["discount", "discountAmount", "discountPercent"]);

const EMPTY_PERMISSIONS: EmployeePermissions = {
  moduleAccess: [],
  recordRules: [],
  actionPermissions: [],
  fieldLevelPermissions: [],
  accessStartDate: null,
  accessEndDate: null,
};
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseAllowed<T extends readonly string[]>(values: FormDataEntryValue[], allowed: T): T[number][] {
  const allowedSet = new Set<string>(allowed);
  const unique = new Set<string>();
  for (const value of values) {
    const normalized = String(value);
    if (allowedSet.has(normalized)) {
      unique.add(normalized);
    }
  }
  return Array.from(unique) as T[number][];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDateValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null;
}

function getLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isEmployeePermissionWindowActive(
  permissions: Pick<EmployeePermissions, "accessStartDate" | "accessEndDate">,
  now = new Date()
) {
  const today = getLocalDateKey(now);

  if (permissions.accessStartDate && today < permissions.accessStartDate) {
    return false;
  }

  if (permissions.accessEndDate && today >= permissions.accessEndDate) {
    return false;
  }

  return true;
}

function withoutPermissionBuckets(permissions: EmployeePermissions): EmployeePermissions {
  return {
    ...permissions,
    moduleAccess: [],
    recordRules: [],
    actionPermissions: [],
    fieldLevelPermissions: [],
  };
}

export function normalizeEmployeePermissions(
  value: unknown,
  options: NormalizeEmployeePermissionsOptions = {}
): EmployeePermissions {
  if (!value || typeof value !== "object") {
    return EMPTY_PERMISSIONS;
  }

  const payload = value as Partial<Record<keyof EmployeePermissions, unknown>>;

  const rawModuleAccess = isStringArray(payload.moduleAccess)
    ? parseAllowed(payload.moduleAccess, MODULE_ACCESS_OPTIONS)
    : [];
  const moduleAccessSet = new Set<ModuleAccessOption>(rawModuleAccess);
  if (moduleAccessSet.has("CRM")) {
    moduleAccessSet.add("PROJECT");
    moduleAccessSet.add("SALES");
  }
  const moduleAccess = Array.from(moduleAccessSet);
  const recordRules = isStringArray(payload.recordRules)
    ? parseAllowed(payload.recordRules, RECORD_RULE_OPTIONS)
    : [];
  const actionPermissions = isStringArray(payload.actionPermissions)
    ? parseAllowed(payload.actionPermissions, ACTION_PERMISSION_OPTIONS)
    : [];
  const fieldLevelPermissions = isStringArray(payload.fieldLevelPermissions)
    ? parseAllowed(payload.fieldLevelPermissions, FIELD_LEVEL_PERMISSION_OPTIONS)
    : [];
  const accessStartDate = parseDateValue(payload.accessStartDate);
  const accessEndDate = parseDateValue(payload.accessEndDate);

  const normalized = {
    moduleAccess,
    recordRules,
    actionPermissions,
    fieldLevelPermissions,
    accessStartDate,
    accessEndDate,
  };

  if (
    options.enforceAccessWindow !== false &&
    !isEmployeePermissionWindowActive(normalized, options.now)
  ) {
    return withoutPermissionBuckets(normalized);
  }

  return normalized;
}

export function parseEmployeePermissionsFromFormData(formData: FormData): EmployeePermissions {
  return {
    moduleAccess: parseAllowed(formData.getAll("moduleAccess"), MODULE_ACCESS_OPTIONS),
    recordRules: parseAllowed(formData.getAll("recordRules"), RECORD_RULE_OPTIONS),
    actionPermissions: parseAllowed(formData.getAll("actionPermissions"), ACTION_PERMISSION_OPTIONS),
    fieldLevelPermissions: parseAllowed(
      formData.getAll("fieldLevelPermissions"),
      FIELD_LEVEL_PERMISSION_OPTIONS
    ),
    accessStartDate: parseDateValue(formData.get("accessStartDate")),
    accessEndDate: parseDateValue(formData.get("accessEndDate")),
  };
}

export function hasPermission<K extends PermissionBucket>(
  permissions: EmployeePermissions | null | undefined,
  bucket: K,
  value: EmployeePermissions[K][number]
) {
  if (!permissions) return false;
  const activePermissions = normalizeEmployeePermissions(permissions);
  return (activePermissions[bucket] as readonly string[]).includes(value as string);
}

export function hasFieldLevelPermission(
  permissions: EmployeePermissions | null | undefined,
  fieldPermission: FieldLevelPermissionOption
) {
  return hasPermission(permissions, "fieldLevelPermissions", fieldPermission);
}

export function isFieldAllowedByPermissions(
  permissions: EmployeePermissions | null | undefined,
  fieldName: string
) {
  if (BUDGET_FIELD_KEYS.has(fieldName)) {
    return hasFieldLevelPermission(permissions, "BUDGET");
  }
  if (PROFIT_FIELD_KEYS.has(fieldName)) {
    return hasFieldLevelPermission(permissions, "PROFIT");
  }
  if (DISCOUNT_FIELD_KEYS.has(fieldName)) {
    return hasFieldLevelPermission(permissions, "DISCOUNT");
  }
  return true;
}

export function stripRestrictedFormFields(
  formData: FormData,
  permissions: EmployeePermissions | null | undefined
) {
  for (const field of BUDGET_FIELD_KEYS) {
    if (!hasFieldLevelPermission(permissions, "BUDGET")) {
      formData.delete(field);
    }
  }

  for (const field of PROFIT_FIELD_KEYS) {
    if (!hasFieldLevelPermission(permissions, "PROFIT")) {
      formData.delete(field);
    }
  }

  for (const field of DISCOUNT_FIELD_KEYS) {
    if (!hasFieldLevelPermission(permissions, "DISCOUNT")) {
      formData.delete(field);
    }
  }
}

export function sanitizeRecordByFieldPermissions<T extends Record<string, unknown>>(
  record: T,
  permissions: EmployeePermissions | null | undefined
): T {
  const cloned = { ...record };
  for (const key of Object.keys(cloned)) {
    if (!isFieldAllowedByPermissions(permissions, key)) {
      cloned[key as keyof T] = null as T[keyof T];
    }
  }
  return cloned;
}

export function sanitizeListByFieldPermissions<T extends Record<string, unknown>>(
  records: T[],
  permissions: EmployeePermissions | null | undefined
) {
  return records.map((record) => sanitizeRecordByFieldPermissions(record, permissions));
}

export function buildProjectWhereForViewer(input: {
  userId: string;
  role: Role | string;
  permissions?: EmployeePermissions | null;
}): Prisma.ProjectWhereInput {
  const { userId, role } = input;
  const normalized = normalizeEmployeePermissions(input.permissions);
  const hasProjectModuleAccess = normalized.moduleAccess.includes("PROJECT");
  const rules = normalized.recordRules;

  if (role !== "ADMIN" && !hasProjectModuleAccess) {
    return { id: "__no_access__" };
  }

  if (role === "ADMIN" || rules.includes("RECORD_RULES")) {
    return {};
  }

  if (rules.length === 0) {
    // Strict mode: non-admin users need explicit record rule assignments.
    return { id: "__no_access__" };
  }

  const or: Prisma.ProjectWhereInput[] = [];
  const directAssignmentFilter: Prisma.ProjectWhereInput = {
    assignments: { some: { userId, isActive: true } },
  };

  if (rules.includes("ASSIGN_PROJECT")) {
    or.push(directAssignmentFilter);
  }

  if (rules.includes("OWN_RECORD")) {
    if (role === "BA") {
      or.push({ managerId: userId });
    } else {
      or.push(directAssignmentFilter);
    }
  }

  if (rules.includes("TEAM_RECORD")) {
    if (role === "BA") {
      or.push({
        OR: [
          { managerId: userId },
          {
            assignments: {
              some: {
                isActive: true,
                user: {
                  assignments: {
                    some: {
                      isActive: true,
                      project: { managerId: userId },
                    },
                  },
                },
              },
            },
          },
        ],
      });
    } else {
      or.push({
        OR: [
          directAssignmentFilter,
          {
            assignments: {
              some: {
                isActive: true,
                user: {
                  assignments: {
                    some: {
                      isActive: true,
                      project: {
                        assignments: {
                          some: { userId, isActive: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      });
    }
  }

  if (or.length === 0) {
    return { id: "__no_access__" };
  }

  return { OR: or };
}

export function getCrmAllowedCreatorIds(
  userId: string,
  role: Role | string,
  permissions: EmployeePermissions | null | undefined | unknown,
  teamMemberIds: string[] = []
) {
  const normalized = normalizeEmployeePermissions(permissions);
  const rules = normalized.recordRules;

  if (role === "ADMIN" || rules.includes("RECORD_RULES")) {
    return null as string[] | null;
  }

  const allowed = new Set<string>();

  if (rules.includes("OWN_RECORD")) {
    allowed.add(userId);
  }

  if (rules.includes("TEAM_RECORD") || rules.includes("ASSIGN_PROJECT")) {
    allowed.add(userId);
    for (const id of teamMemberIds) {
      allowed.add(id);
    }
  }

  return Array.from(allowed);
}
