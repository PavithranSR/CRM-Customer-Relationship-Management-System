"use client";

import { format } from "date-fns";
import { Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getEmployeeAvatarLetter,
  type TaskEmployeeProfileState,
} from "@/components/projects/admin-project-task-monitor-parts/shared";

interface EmployeeProfileDialogProps {
  selectedTaskEmployeeProfile: TaskEmployeeProfileState | null;
  onOpenChange: (open: boolean) => void;
}

export function EmployeeProfileDialog({
  selectedTaskEmployeeProfile,
  onOpenChange,
}: EmployeeProfileDialogProps) {
  return (
    <Dialog
      open={Boolean(selectedTaskEmployeeProfile)}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <DialogContent className="max-w-2xl overflow-hidden border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.32)]">
        {selectedTaskEmployeeProfile ? (
          <>
            <div className="border-b border-slate-200 bg-gradient-to-r from-amber-50 via-white to-white px-6 py-5">
              <DialogHeader className="text-left">
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#c89212] text-[3rem] font-medium text-white">
                      {getEmployeeAvatarLetter(selectedTaskEmployeeProfile.employee.name)}
                    </div>
                    <span
                      className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${
                        selectedTaskEmployeeProfile.employee.isActive === false ? "bg-slate-300" : "bg-emerald-500"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="truncate text-2xl font-semibold text-slate-900">
                      {selectedTaskEmployeeProfile.employee.name}
                    </DialogTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Assigned to {selectedTaskEmployeeProfile.taskTitle}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                      <span className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-cyan-500" />
                        {selectedTaskEmployeeProfile.employee.email || "No email address"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-slate-400" />
                        {selectedTaskEmployeeProfile.employee.phone || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.role}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.isActive === false ? "Inactive" : "Active"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.department || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Position</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.position || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Task</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.taskTitle}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email</p>
                <p className="mt-2 break-all text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.email || "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hire Date</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {selectedTaskEmployeeProfile.employee.hireDate
                    ? format(new Date(selectedTaskEmployeeProfile.employee.hireDate), "MMM d, yyyy")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              {selectedTaskEmployeeProfile.employee.email ? (
                <Button
                  asChild
                  type="button"
                  className="h-10 rounded-md bg-[#44a2de] px-4 text-sm font-semibold text-white hover:bg-[#3991ca]"
                >
                  <a href={`mailto:${selectedTaskEmployeeProfile.employee.email}`}>Send message</a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                className="h-10 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
