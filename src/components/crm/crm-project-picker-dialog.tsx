"use client";

import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCrmProjectType, type CrmProjectTypeItem } from "@/actions/crm-project-types.actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ProjectPickerProject = Pick<
  CrmProjectTypeItem,
  "id" | "name" | "budget" | "category" | "gstPercent" | "status" | "description" | "createdAt" | "updatedAt"
>;

interface CrmProjectPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTypes: ProjectPickerProject[];
  onSelect: (projectType: ProjectPickerProject) => void;
  onProjectCreated: (projectType: ProjectPickerProject) => void;
  selectedProjectName?: string;
}

const formatBudget = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export function CrmProjectPickerDialog({
  open,
  onOpenChange,
  projectTypes,
  onSelect,
  onProjectCreated,
  selectedProjectName,
}: CrmProjectPickerDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Software");
  const [budget, setBudget] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [status, setStatus] = useState("Active");
  const [description, setDescription] = useState("");

  const resetState = () => {
    setSearchQuery("");
    setActiveCategory("all");
    setShowCreateForm(false);
    setName("");
    setCategory("Software");
    setBudget("");
    setGstPercent("18");
    setStatus("Active");
    setDescription("");
  };

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        projectTypes
          .map((projectType) => projectType.category?.trim() || "Other")
          .filter(Boolean),
      ),
    ).sort((left, right) => left.localeCompare(right));

    return ["all", ...uniqueCategories];
  }, [projectTypes]);

  const filteredProjectTypes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projectTypes.filter((projectType) => {
      const resolvedCategory = projectType.category?.trim() || "Other";
      if (activeCategory !== "all" && resolvedCategory !== activeCategory) {
        return false;
      }

      if (!query) return true;

      return [
        projectType.name,
        projectType.category,
        projectType.status,
        projectType.description || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [activeCategory, projectTypes, searchQuery]);

  const effectiveSelectedProjectId = useMemo(() => {
    const normalizedSelectedName = selectedProjectName?.trim().toLowerCase();
    if (normalizedSelectedName) {
      const matchedProject = filteredProjectTypes.find(
        (projectType) => projectType.name.trim().toLowerCase() === normalizedSelectedName,
      );
      if (matchedProject) return matchedProject.id;
    }

    return filteredProjectTypes[0]?.id ?? null;
  }, [filteredProjectTypes, selectedProjectName]);

  const numericBudget = Number(budget || 0);
  const numericGst = Number(gstPercent || 0);
  const gstAmount =
    Number.isFinite(numericBudget) && Number.isFinite(numericGst)
      ? numericBudget * (numericGst / 100)
      : 0;
  const totalAmount =
    Number.isFinite(numericBudget) && Number.isFinite(numericGst)
      ? numericBudget + gstAmount
      : 0;

  const handleCreateProject = () => {
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    if (!Number.isFinite(numericBudget) || numericBudget <= 0) {
      toast.error("Budget must be greater than 0");
      return;
    }

    if (!Number.isFinite(numericGst) || numericGst < 0 || numericGst > 100) {
      toast.error("GST must be between 0 and 100");
      return;
    }

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("category", category);
    formData.set("budget", String(numericBudget));
    formData.set("gstPercent", String(numericGst));
    formData.set("status", status);
    if (description.trim()) {
      formData.set("description", description.trim());
    }

    startTransition(async () => {
      const result = await createCrmProjectType(formData);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not create project");
        return;
      }

      if (!result.data) {
        toast.error("Project was created, but the response was incomplete");
        return;
      }

      onProjectCreated(result.data);
      onSelect(result.data);
      toast.success("Project added");
      resetState();
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetState();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[min(95vh,960px)] w-[min(99vw,1780px)] max-w-[1780px] flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[20px] font-semibold text-slate-950">Search: Project</DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {showCreateForm ? (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-6">
              <p className="text-sm font-semibold text-slate-950">Create New Project</p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Project Name</label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Project name"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
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
                  <label className="text-sm font-medium text-slate-700">Budget</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={budget}
                    onChange={(event) => setBudget(event.target.value)}
                    placeholder="Budget"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">GST %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={gstPercent}
                    onChange={(event) => setGstPercent(event.target.value)}
                    placeholder="GST %"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700"
                    disabled={isPending}
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>

                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Description</label>
                  <Textarea
                    rows={5}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Short project details"
                    disabled={isPending}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Budget</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatBudget(numericBudget || 0)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">GST Amount</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatBudget(gstAmount || 0)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Total</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">{formatBudget(totalAmount || 0)}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleCreateProject} disabled={isPending}>
                  {isPending ? "Saving..." : "Create New"}
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-white">
            <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-6">
              <div className="flex flex-col gap-3">
                <div className="flex w-full items-center gap-0 overflow-hidden rounded-md border border-slate-300 bg-white">
                  <div className="flex flex-1 items-center gap-2 px-3">
                    <Search className="h-4 w-4 text-slate-500" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search..."
                      autoComplete="off"
                      className="border-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="w-px self-stretch bg-slate-200" />
                  <select
                    value={activeCategory}
                    onChange={(event) => setActiveCategory(event.target.value)}
                    className="h-10 min-w-[320px] border-0 bg-white px-3 text-sm text-slate-700 focus:outline-none"
                  >
                    {categories.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry === "all" ? "All Categories" : entry}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="w-full">
                <table className="w-full table-fixed border-collapse">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-left text-sm font-semibold text-slate-950">
                      <th className="w-[58%] px-4 py-4 sm:px-6">Project Name</th>
                      <th className="w-[24%] px-4 py-4">Category</th>
                      <th className="w-[18%] px-4 py-4 text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjectTypes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-16 text-center text-sm text-slate-500 sm:px-6">
                          No projects match the current search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredProjectTypes.map((projectType) => {
                        const isSelected = effectiveSelectedProjectId === projectType.id;

                        return (
                          <tr
                            key={projectType.id}
                            onClick={() => {
                              onSelect(projectType);
                              onOpenChange(false);
                            }}
                            className={`cursor-pointer border-b border-slate-200 transition ${
                              isSelected ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                            }`}
                          >
                            <td className="px-4 py-4 align-top sm:px-6">
                              <p className="truncate text-base font-medium text-slate-950">{projectType.name}</p>
                            </td>
                            <td className="px-4 py-4 align-top text-sm text-slate-700">
                              {projectType.category || "Other"}
                            </td>
                            <td className="px-4 py-4 align-top text-right text-sm font-medium text-slate-950">
                              {formatBudget(Number(projectType.budget || 0))}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreateForm(true)}>
                  Create New
                </Button>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
