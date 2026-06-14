"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { changeCurrentUserPassword, updateCurrentUserEmail } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  DEFAULT_PROJECT_EXPORT_FIELD_KEYS,
  PROJECT_EXPORT_FIELD_OPTIONS,
  readStoredProjectExportFieldKeys,
  writeStoredProjectExportFieldKeys,
} from "@/lib/project-export-settings";
import type { ProjectExportFieldKey } from "@/lib/project-export-settings";

interface SettingsDetailsProps {
  email: string;
  moduleAccess: string[];
  actionPermissions: string[];
  recordRules: string[];
  fieldLevelPermissions: string[];
}

function formatPermission(value: string) {
  switch (value) {
    case "PROJECT":
      return "Projects";
    case "CRM":
      return "CRM";
    case "SALES":
      return "Sales";
    case "CREATE":
      return "Create";
    case "EDIT":
      return "Edit";
    case "UPDATE":
      return "Update";
    case "DELETE":
      return "Delete";
    case "OWN_RECORD":
      return "Own Records";
    case "TEAM_RECORD":
      return "Team Records";
    case "ASSIGN_PROJECT":
      return "Assigned Projects";
    case "RECORD_RULES":
      return "All Records";
    case "BUDGET":
      return "Budget";
    case "PROFIT":
      return "Profit";
    case "DISCOUNT":
      return "Discount";
    default:
      return value;
  }
}

function PermissionList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      {items.length > 0 ? (
        <div className="mt-2 space-y-1">
          {items.map((item) => (
            <p key={`${title}-${item}`}>✔ {formatPermission(item)}</p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">- None</p>
      )}
    </div>
  );
}

export function SettingsDetails({
  email,
  moduleAccess,
  actionPermissions,
  recordRules,
  fieldLevelPermissions,
}: SettingsDetailsProps) {
  const { resolvedTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [projectExportFieldKeys, setProjectExportFieldKeys] = useState<ProjectExportFieldKey[]>(
    DEFAULT_PROJECT_EXPORT_FIELD_KEYS
  );

  useEffect(() => {
    const storedKeys = readStoredProjectExportFieldKeys();
    const timeout = window.setTimeout(() => {
      setProjectExportFieldKeys(storedKeys);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  const themeLabel = useMemo(
    () => (resolvedTheme === "dark" ? "Dark" : "Light"),
    [resolvedTheme]
  );

  const toggleProjectExportField = (fieldKey: ProjectExportFieldKey, checked: boolean) => {
    setProjectExportFieldKeys((current) => {
      if (checked) {
        const next = current.includes(fieldKey) ? current : [...current, fieldKey];
        writeStoredProjectExportFieldKeys(next);
        return next;
      }

      if (current.length === 1 && current.includes(fieldKey)) {
        return current;
      }

      const next = current.filter((item) => item !== fieldKey);
      writeStoredProjectExportFieldKeys(next);
      return next;
    });
  };

  const resetProjectExportFields = () => {
    setProjectExportFieldKeys(DEFAULT_PROJECT_EXPORT_FIELD_KEYS);
    writeStoredProjectExportFieldKeys(DEFAULT_PROJECT_EXPORT_FIELD_KEYS);
  };

  const handleEmailUpdate = () => {
    const formData = new FormData();
    formData.append("email", newEmail);

    startTransition(async () => {
      const result = await updateCurrentUserEmail(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Email updated successfully");
      setIsEmailDialogOpen(false);
    });
  };

  const handlePasswordChange = () => {
    const formData = new FormData();
    formData.append("currentPassword", currentPassword);
    formData.append("newPassword", newPassword);
    formData.append("confirmPassword", confirmPassword);

    startTransition(async () => {
      const result = await changeCurrentUserPassword(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordDialogOpen(false);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Account options, access summary, and preferences</p>
      </div>

      <div className="theme-card p-6">
        <div className="space-y-6 text-base">
          <div>
            <p className="font-semibold">[Settings]</p>
          </div>

          <div className="space-y-3">
            <p className="font-semibold">🔐 Account</p>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setIsPasswordDialogOpen(true)}>
                Change Password
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsEmailDialogOpen(true)}>
                Update Email
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Current Email: {email}</p>
          </div>

          <div className="space-y-4">
            <p className="font-semibold">📊 Access Summary</p>
            <PermissionList title="Module Access:" items={moduleAccess} />
            <PermissionList title="Action Permissions:" items={actionPermissions} />
            <PermissionList title="Record Rules:" items={recordRules} />
            <PermissionList title="Field Access:" items={fieldLevelPermissions} />
          </div>

          <div className="theme-muted-panel space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Export</p>
                <p className="text-sm text-muted-foreground">
                  Choose which project data fields are included when exporting records.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={resetProjectExportFields}>
                Reset Defaults
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {PROJECT_EXPORT_FIELD_OPTIONS.map((field) => {
                const checked = projectExportFieldKeys.includes(field.key);

                return (
                  <label
                    key={field.key}
                  className="flex items-center gap-3 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        toggleProjectExportField(field.key, nextChecked === true)
                      }
                    />
                    <span>{field.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              The project export button uses only these selected fields.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-semibold">⚙ Preferences</p>
            <p>- Theme: {themeLabel}</p>
            <p>- Language: English</p>
          </div>
        </div>
      </div>

      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Email</DialogTitle>
            <DialogDescription>Change the email address used for your account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              disabled={isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setNewEmail(email);
                setIsEmailDialogOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleEmailUpdate} disabled={isPending}>
              Save Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update your account password securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <PasswordInput
                id="currentPassword"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <PasswordInput
                id="newPassword"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setIsPasswordDialogOpen(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handlePasswordChange} disabled={isPending}>
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
