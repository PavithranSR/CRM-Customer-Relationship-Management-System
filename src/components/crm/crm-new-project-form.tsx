"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCrmProject, generateCrmProjectCode, updateCrmProject } from "@/actions/crm-projects.actions";
import { updateCrmProjectType } from "@/actions/crm-project-types.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CrmProjectFormInitialValues {
  recordType: "project" | "project-type";
  name: string;
  category: string;
  projectCode?: string | null;
  durationDays?: number;
  budgetAmount: number;
  gstPercent: number;
  status: string;
  createdDate: Date | string;
  description?: string | null;
}

interface CrmNewProjectFormProps {
  nextHref?: string;
  mode?: "create" | "edit";
  projectId?: string;
  initialValues?: CrmProjectFormInitialValues | null;
}

function formatDateForInput(value: Date | string | undefined | null) {
  if (!value) return new Date().toISOString().split("T")[0];
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function CrmNewProjectForm({
  nextHref = "/crm/quotations?tab=projects",
  mode = "create",
  projectId,
  initialValues = null,
}: CrmNewProjectFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = mode === "edit";

  const [name, setName] = useState(initialValues?.name || "");
  const [category, setCategory] = useState(initialValues?.category || "Software");
  const [projectCode, setProjectCode] = useState(initialValues?.projectCode || "");
  const [durationDays] = useState(initialValues?.durationDays || 30);
  const [budgetAmount, setBudgetAmount] = useState(
    initialValues ? String(initialValues.budgetAmount) : "",
  );
  const [gstPercent, setGstPercent] = useState(
    initialValues ? String(initialValues.gstPercent) : "18",
  );
  const [status, setStatus] = useState(initialValues?.status || "Active");
  const [createdDate] = useState(formatDateForInput(initialValues?.createdDate));
  const [description, setDescription] = useState(initialValues?.description || "");
  const budgetValue = Number(budgetAmount || 0);
  const gstValue = Number(gstPercent || 0);
  const gstAmount = useMemo(() => {
    if (!Number.isFinite(budgetValue) || !Number.isFinite(gstValue)) return 0;
    return budgetValue * (gstValue / 100);
  }, [budgetValue, gstValue]);
  const totalAmount = useMemo(() => {
    if (!Number.isFinite(budgetValue)) return 0;
    return budgetValue + gstAmount;
  }, [budgetValue, gstAmount]);
  const currency = useMemo(
    () => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }),
    [],
  );

  useEffect(() => {
    if (isEditing) return;

    let mounted = true;
    generateCrmProjectCode()
      .then((code) => {
        if (mounted) setProjectCode(code);
      })
      .catch(() => {
        if (mounted) setProjectCode("");
      });
    return () => {
      mounted = false;
    };
  }, [isEditing]);

  const onSubmit = () => {
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("category", category);
    formData.set("projectCode", projectCode);
    formData.set("durationDays", String(durationDays));
    formData.set("budget", budgetAmount);
    formData.set("price", budgetAmount);
    formData.set("budgetAmount", budgetAmount);
    formData.set("gstPercent", gstPercent);
    formData.set("status", status);
    formData.set("createdDate", createdDate);
    formData.set("description", description);

    startTransition(async () => {
      const result = isEditing && projectId
        ? initialValues?.recordType === "project-type"
          ? await updateCrmProjectType(projectId, formData)
          : await updateCrmProject(projectId, formData)
        : await createCrmProject(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? "Project updated" : "Project created");
      router.push(nextHref);
    });
  };

  const title = isEditing ? "Edit Project" : "New Project";
  const descriptionText = isEditing
    ? "Update project details used in quotations."
    : "Enter project details to use in quotations.";
  const submitLabel = isEditing ? "Update Project" : "Save Project";
  const projectIdPlaceholder = isEditing
    ? "Not available for this project"
    : "Generating...";

  return (
    <div className="space-y-4 rounded-md border bg-white p-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{descriptionText}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Project Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" disabled={isPending} />
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            disabled={isPending}
          >
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Internship">Internship</option>
            <option value="Support">Support</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Budget Amount</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={budgetAmount}
            onChange={(event) => setBudgetAmount(event.target.value)}
            placeholder="Example: 15000"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Created Date</Label>
          <Input type="date" value={createdDate} readOnly disabled />
        </div>

        <div className="space-y-2">
          <Label>GST (%)</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={gstPercent}
            onChange={(event) => setGstPercent(event.target.value)}
            placeholder="Example: 18"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            disabled={isPending}
          >
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label>Project ID</Label>
          <Input
            value={projectCode}
            readOnly
            placeholder={projectIdPlaceholder}
            disabled
          />
        </div>

        <div className="space-y-2">
          <Label>GST Amount</Label>
          <Input value={currency.format(gstAmount)} readOnly disabled />
        </div>

        <div className="space-y-2">
          <Label>Total Project Amount</Label>
          <Input value={currency.format(totalAmount)} readOnly disabled />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Project Description (Optional)</Label>
        <Textarea
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short details"
          disabled={isPending}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSubmit} disabled={isPending}>
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(nextHref)} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
