"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProject, updateProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { Priority, ProjectType, ProjectStatus } from "@prisma/client";

interface ProjectFormProps {
  project?: {
    id: string;
    name: string;
    description?: string | null;
    code: string;
    clientId?: string | null;
    serviceName?: string | null;
    unitName?: string | null;
    unitCount?: number | null;
    unitPrice?: number | null;
    costPerUnit?: number | null;
    subtotalAmount?: number | null;
    gstPercent?: number | null;
    gstAmount?: number | null;
    finalAmount?: number | null;
    profitAmount?: number | null;
    invoicingPolicy?: string | null;
    tags?: string | null;
    expectedClosingDate?: Date | null;
    type?: ProjectType;
    status?: ProjectStatus;
    priority?: Priority;
    estimatedHours?: number | null;
    startDate?: Date | null;
    deadline?: Date | null;
    managerId?: string | null;
  };
  managers: { id: string; name: string; role?: string; email?: string | null }[];
  clients: {
    id: string;
    linkedClientId?: string | null;
    name: string;
    email: string;
    serviceName: string | null;
    projectName?: string | null;
    quotationNo?: string | null;
    sourceTitle?: string | null;
    tags: string | null;
    phone: string | null;
    country: string | null;
  }[];
  compactCreate?: boolean;
  formTitle?: string;
  showStageOverview?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const stageRows = [
  { stage: "PLANNING", description: "Requirements gathering and proposal finalization" },
  { stage: "IN_PROGRESS", description: "Execution of project tasks and milestones" },
  { stage: "ON_HOLD", description: "Temporarily paused due to dependency or decision" },
  { stage: "COMPLETED", description: "Project delivered and closed successfully" },
];

const clientColumnOptions = [
  { id: "name", label: "Name" },
  { id: "created_on", label: "Created on" },
  { id: "gstin", label: "GSTIN" },
  { id: "pan", label: "PAN" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "salesperson", label: "Salesperson" },
  { id: "activities", label: "Activities" },
  { id: "street", label: "Street" },
  { id: "city", label: "City" },
  { id: "state", label: "State" },
  { id: "country", label: "Country" },
  { id: "pricelist", label: "Pricelist" },
  { id: "stats", label: "Stats" },
  { id: "tags", label: "Tags" },
  { id: "responsible", label: "Responsible" },
  { id: "reminders", label: "Reminders" },
  { id: "follow_up_status", label: "Follow-up Status" },
  { id: "total_due", label: "Total Due" },
  { id: "total_overdue", label: "Total Overdue" },
] as const;

const defaultClientColumns = ["name", "email", "phone", "city", "state", "total_due", "total_overdue"] as const;

function getClientColumnValue(
  client: ProjectFormProps["clients"][number],
  columnId: (typeof clientColumnOptions)[number]["id"]
) {
  switch (columnId) {
    case "name":
      return client.name;
    case "created_on":
      return "Today";
    case "gstin":
      return "GSTIN";
    case "pan":
      return "PAN";
    case "email":
      return client.email;
    case "phone":
      return client.phone || "-";
    case "salesperson":
      return "Sales";
    case "activities":
      return client.quotationNo || client.sourceTitle || "0";
    case "street":
      return "-";
    case "city":
      return client.country || "-";
    case "state":
      return "-";
    case "country":
      return client.country || "-";
    case "pricelist":
      return "Standard";
    case "stats":
      return "0";
    case "tags":
      return client.tags || "-";
    case "responsible":
      return "Admin";
    case "reminders":
      return "0";
    case "follow_up_status":
      return "None";
    case "total_due":
      return "0.00";
    case "total_overdue":
      return "0.00";
    default:
      return "-";
  }
}

function getClientColumnClassName(columnId: (typeof clientColumnOptions)[number]["id"]) {
  switch (columnId) {
    case "name":
      return "max-w-[260px]";
    case "email":
      return "max-w-[240px]";
    case "phone":
      return "max-w-[150px]";
    case "total_due":
    case "total_overdue":
      return "text-right";
    default:
      return "";
  }
}

function getClientOptionLabel(client: ProjectFormProps["clients"][number]) {
  if (client.quotationNo) {
    return `${client.quotationNo} - ${client.name}`;
  }
  return `${client.name} (${client.email})`;
}

function isOpportunityLikeValue(value?: string | null) {
  return /\bopportunity\b/i.test(value ?? "");
}

function getAutoProjectTitleFromClient(client: ProjectFormProps["clients"][number] | null | undefined) {
  const preferredProjectName = client?.projectName?.trim() || "";
  if (preferredProjectName && !isOpportunityLikeValue(preferredProjectName)) {
    return preferredProjectName;
  }

  const preferredServiceName = client?.serviceName?.trim() || "";
  if (preferredServiceName && !isOpportunityLikeValue(preferredServiceName)) {
    return preferredServiceName;
  }

  return "";
}

export function ProjectForm({
  project,
  managers,
  clients,
  compactCreate = false,
  formTitle,
  showStageOverview = true,
  onSuccess,
  onCancel,
}: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!project;
  const isCompactCreate = !isEditing && compactCreate;

  const [clientId, setClientId] = useState(project?.clientId || "none");
  const [isBillable, setIsBillable] = useState(Boolean(project?.clientId && project.clientId !== "none"));
  const [projectPriority, setProjectPriority] = useState<Priority>(project?.priority || "MEDIUM");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>(project?.status || "PLANNING");
  const [managerId, setManagerId] = useState(project?.managerId || "none");
  const [projectTitle, setProjectTitle] = useState(project?.name || "");
  const [invoicingPolicy, setInvoicingPolicy] = useState(project?.invoicingPolicy || "fixed_price");
  const [serviceName, setServiceName] = useState(project?.serviceName || "");
  const [tags, setTags] = useState(project?.tags || "");
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [isClientSearchDialogOpen, setIsClientSearchDialogOpen] = useState(false);
  const [isClientColumnFilterOpen, setIsClientColumnFilterOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientSearchPage, setClientSearchPage] = useState(0);
  const [selectedClientColumns, setSelectedClientColumns] = useState<string[]>([...defaultClientColumns]);
  const [unitName, setUnitName] = useState(project?.unitName || "");
  const [unitCount, setUnitCount] = useState(project?.unitCount?.toString() || "");
  const [unitPrice, setUnitPrice] = useState(project?.unitPrice?.toString() || "");
  const [costPerUnit, setCostPerUnit] = useState(project?.costPerUnit?.toString() || "");
  const [gstPercent, setGstPercent] = useState((project?.gstPercent ?? 18).toString());
  const availableClients = useMemo(() => {
    const seenQuotationIds = new Set<string>();
    return clients.filter((client) => {
      if (seenQuotationIds.has(client.id)) {
        return false;
      }

      seenQuotationIds.add(client.id);
      return true;
    });
  }, [clients]);
  const selectedClient = useMemo(
    () => availableClients.find((item) => item.id === clientId) ?? clients.find((item) => item.id === clientId),
    [availableClients, clients, clientId]
  );
  const canAssignLead = isCompactCreate ? isBillable && clientId !== "none" : clientId !== "none";

  const filteredClientOptions = useMemo(() => {
    const query = clientQuery.trim().toLowerCase();
    return availableClients.filter((client) => {
      if (!query) return true;
      return (
        client.name.toLowerCase().includes(query) ||
        client.email.toLowerCase().includes(query) ||
        (client.phone ?? "").toLowerCase().includes(query) ||
        (client.country ?? "").toLowerCase().includes(query) ||
        (client.serviceName ?? "").toLowerCase().includes(query)
      );
    });
  }, [availableClients, clientQuery]);

  const quickClientOptions = useMemo(
    () => filteredClientOptions.slice(0, 3),
    [filteredClientOptions]
  );

  const hasMoreClientResults = useMemo(() => {
    return filteredClientOptions.length > 3;
  }, [filteredClientOptions]);

  const clientSearchPageSize = 5;
  const clientSearchTotalPages = Math.max(1, Math.ceil(filteredClientOptions.length / clientSearchPageSize));
  const safeClientSearchPage = Math.min(clientSearchPage, clientSearchTotalPages - 1);
  const paginatedClientOptions = useMemo(() => {
    const start = safeClientSearchPage * clientSearchPageSize;
    return filteredClientOptions.slice(start, start + clientSearchPageSize);
  }, [filteredClientOptions, safeClientSearchPage]);

  const activeClientColumns = useMemo(
    () => clientColumnOptions.filter((option) => selectedClientColumns.includes(option.id)),
    [selectedClientColumns]
  );

  const clientTableColumnCount = activeClientColumns.length + 2;

  const unitCountNum = Number(unitCount || 0);
  const unitPriceNum = Number(unitPrice || 0);
  const costPerUnitNum = Number(costPerUnit || 0);
  const gstPercentNum = Number(gstPercent || 0);

  const subtotal = unitCountNum * unitPriceNum;
  const gstAmount = subtotal * (gstPercentNum / 100);
  const finalAmount = subtotal + gstAmount;
  const totalCost = unitCountNum * costPerUnitNum;
  const profit = subtotal - totalCost;

  const handleClientChange = (value: string) => {
    setClientId(value);
    setIsClientPickerOpen(false);
    setIsClientSearchDialogOpen(false);
    setIsClientColumnFilterOpen(false);
    setClientQuery("");
    setClientSearchPage(0);
    if (value === "none" && managerId !== "none") {
      setManagerId("none");
    }
    const client = availableClients.find((item) => item.id === value);
    if (!client) {
      if (!isEditing && !projectTitle.trim()) {
        setProjectTitle("");
      }
      return;
    }

    const autoProjectTitle = getAutoProjectTitleFromClient(client);

    if (
      !isEditing ||
      !projectTitle.trim() ||
      projectTitle ===
        getAutoProjectTitleFromClient(selectedClient)
    ) {
      setProjectTitle(autoProjectTitle);
    }

    if (!serviceName && client.serviceName) setServiceName(client.serviceName);
    if (!tags && client.tags) setTags(client.tags);
  };

  const handleManagerChange = (value: string) => {
    if (value !== "none" && !canAssignLead) {
      toast.error("Select a client first before assigning the project lead");
      return;
    }

    setManagerId(value);
  };

  const toggleClientColumn = (optionId: string, checked: boolean) => {
    setSelectedClientColumns((current) => {
      if (checked) {
        return current.includes(optionId) ? current : [...current, optionId];
      }

      return current.filter((item) => item !== optionId);
    });
  };

  async function handleSubmit(formData: FormData) {
    const resolvedProjectName = projectTitle.trim()
      || getAutoProjectTitleFromClient(selectedClient)
      || project?.name
      || "Project";
    const resolvedLinkedClientId =
      !isBillable || clientId === "none"
        ? "none"
        : selectedClient?.linkedClientId || selectedClient?.id || clientId;

    formData.set("name", resolvedProjectName);
    formData.set("type", "TEAM");
    formData.set("priority", projectPriority);
    formData.set("managerId", managerId || "none");
    formData.set("clientId", resolvedLinkedClientId);

    if (!isCompactCreate) {
      formData.set("serviceName", serviceName);
      formData.set("unitName", unitName);
      formData.set("unitCount", unitCount);
      formData.set("unitPrice", unitPrice);
      formData.set("costPerUnit", costPerUnit);
      formData.set("gstPercent", gstPercent);
      formData.set("subtotalAmount", subtotal.toFixed(2));
      formData.set("gstAmount", gstAmount.toFixed(2));
      formData.set("finalAmount", finalAmount.toFixed(2));
      formData.set("profitAmount", profit.toFixed(2));
      formData.set("tags", tags);
      formData.set("invoicingPolicy", invoicingPolicy);
    }

    if (isEditing) {
      formData.set("status", projectStatus);
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateProject(project.id, formData)
        : await createProject(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success(isEditing ? "Project updated successfully" : "Project created successfully");
        onSuccess?.();
        router.refresh();
        if (!onSuccess) {
          router.push("/projects");
        }
      }
    });
  }

  return (
    <div className="space-y-6">
      {showStageOverview && !isCompactCreate && (
        <Card>
          <CardHeader>
            <CardTitle>3. Project Management Module</CardTitle>
          </CardHeader>
          <CardContent>
            <h3 className="mb-3 text-lg font-semibold">3.1 Project Stages</h3>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map((row) => (
                    <tr key={row.stage} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{row.stage}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{formTitle || (isCompactCreate ? "New Project" : "3.2 NEW Stage - Project Register Page")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {isCompactCreate ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="compact-project-manager">Assigned Leader</Label>
                    <Select value={managerId} onValueChange={handleManagerChange}>
                      <SelectTrigger id="compact-project-manager">
                        <SelectValue placeholder="Assign later" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name}{manager.role ? ` (${manager.role === "TEAMLEADER" ? "TL" : "BA"})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {canAssignLead
                        ? "You can assign the leader now or leave it for later."
                        : "Select the customer first, then assign the leader."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectTitle">Project Name *</Label>
                    <Input
                      id="projectTitle"
                      value={projectTitle}
                      onChange={(event) => setProjectTitle(event.target.value)}
                      placeholder="e.g. Health Care Management"
                      required
                      disabled={isPending}
                      className="h-16 text-3xl text-slate-600 placeholder:text-slate-400"
                    />
                  </div>

                  <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="compact-project-billable"
                        checked={isBillable}
                        onCheckedChange={(checked) => {
                          const nextValue = checked === true;
                          setIsBillable(nextValue);
                          if (!nextValue) {
                            if (managerId !== "none") {
                              setManagerId("none");
                            }
                            setClientId("none");
                            setIsClientPickerOpen(false);
                            setIsClientSearchDialogOpen(false);
                          }
                        }}
                        disabled={isPending}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-3">
                        <label htmlFor="compact-project-billable" className="block cursor-pointer">
                          <p className="text-base font-semibold text-slate-900">Billable</p>
                          <p className="text-sm text-slate-500">
                            Invoice your time and material to customers.
                          </p>
                        </label>

                        {isBillable ? (
                          <div className="space-y-2">
                            <Label htmlFor="clientId">Customer</Label>
                            <Popover open={isClientPickerOpen} onOpenChange={setIsClientPickerOpen}>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-11 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-left text-sm shadow-xs transition-[color,box-shadow] hover:bg-accent/30"
                                >
                                  <span className={selectedClient ? "text-foreground" : "text-muted-foreground"}>
                                    {selectedClient ? getClientOptionLabel(selectedClient) : "Select who to bill..."}
                                  </span>
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-[460px] border-slate-200 bg-white p-0 text-slate-900 shadow-lg">
                                <div className="border-b border-slate-200 px-4 py-3">
                                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3">
                                    <Search className="h-4 w-4 text-slate-400" />
                                    <Input
                                      value={clientQuery}
                                      onChange={(event) => {
                                        setClientQuery(event.target.value);
                                        setClientSearchPage(0);
                                      }}
                                      placeholder="Select who to bill..."
                                      className="border-0 bg-transparent px-0 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                  </div>
                                </div>
                                <div className="p-1">
                                  {quickClientOptions.map((client) => (
                                    <button
                                      key={client.id}
                                      type="button"
                                      className="flex w-full items-start justify-between rounded-sm px-4 py-2 text-left transition hover:bg-slate-100"
                                      onClick={() => handleClientChange(client.id)}
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-base text-slate-900">{getClientOptionLabel(client)}</p>
                                        {client.serviceName ? (
                                          <p className="truncate text-sm text-slate-500">{client.serviceName}</p>
                                        ) : null}
                                      </div>
                                      {client.id === clientId ? (
                                        <Check className="mt-1 h-4 w-4 shrink-0 text-sky-600" />
                                      ) : null}
                                    </button>
                                  ))}
                                  {quickClientOptions.length === 0 ? (
                                    <p className="px-4 py-3 text-sm text-slate-500">No customers found.</p>
                                  ) : null}
                                  {hasMoreClientResults ? (
                                    <button
                                      type="button"
                                      className="px-4 py-2 text-left text-sm text-sky-600 transition hover:text-sky-700"
                                      onClick={() => {
                                        setClientSearchPage(0);
                                        setIsClientSearchDialogOpen(true);
                                      }}
                                    >
                                      Search more...
                                    </button>
                                  ) : null}
                                </div>
                              </PopoverContent>
                            </Popover>
                            {selectedClient ? (
                              <p className="text-xs text-muted-foreground">Customer: {selectedClient.name}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="code">Project Code</Label>
                    <Input
                      id="code"
                      value={isEditing ? (project?.code ?? "") : "Auto-generated on create"}
                      readOnly
                      disabled
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="projectTitle">Project Name *</Label>
                    <Input
                      id="projectTitle"
                      value={projectTitle}
                      onChange={(event) => setProjectTitle(event.target.value)}
                      placeholder="Project name"
                      required
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clientId">Linked Client</Label>
                    <Select name="clientId" value={clientId} onValueChange={handleClientChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {getClientOptionLabel(client)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedClient && (
                      <p className="text-xs text-muted-foreground">
                        Customer: {selectedClient.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              {!isCompactCreate && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="serviceName">Service Name</Label>
                    <Input
                      id="serviceName"
                      value={serviceName}
                      onChange={(event) => setServiceName(event.target.value)}
                      placeholder="Service name"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitName">Unit</Label>
                    <Input
                      id="unitName"
                      value={unitName}
                      onChange={(event) => setUnitName(event.target.value)}
                      placeholder="e.g. Module, Seat"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitCount">Unit Count</Label>
                    <Input
                      id="unitCount"
                      type="number"
                      min="0"
                      value={unitCount}
                      onChange={(event) => setUnitCount(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">Unit Price</Label>
                    <Input
                      id="unitPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costPerUnit">Cost Per Unit</Label>
                    <Input
                      id="costPerUnit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={costPerUnit}
                      onChange={(event) => setCostPerUnit(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gstPercent">GST %</Label>
                    <Input
                      id="gstPercent"
                      type="number"
                      min="0"
                      step="0.01"
                      value={gstPercent}
                      onChange={(event) => setGstPercent(event.target.value)}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subtotalAmount">Subtotal</Label>
                    <Input id="subtotalAmount" value={subtotal.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gstAmount">GST Amount</Label>
                    <Input id="gstAmount" value={gstAmount.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalAmount">Final Amount</Label>
                    <Input id="finalAmount" value={finalAmount.toFixed(2)} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profitAmount">Profit</Label>
                    <Input id="profitAmount" value={profit.toFixed(2)} readOnly disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoicingPolicy">Invoicing Policy</Label>
                    <Select value={invoicingPolicy} onValueChange={setInvoicingPolicy}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select policy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed_price">Fixed Price</SelectItem>
                        <SelectItem value="milestone">Milestone</SelectItem>
                        <SelectItem value="time_material">Time & Material</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <Input
                      id="tags"
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="e.g. Priority, B2B"
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expectedClosingDate">Expected Closing Date</Label>
                    <Input
                      id="expectedClosingDate"
                      name="expectedClosingDate"
                      type="date"
                      defaultValue={project?.expectedClosingDate ? new Date(project.expectedClosingDate).toISOString().split("T")[0] : ""}
                      disabled={isPending}
                    />
                  </div>
                </>
              )}

              {!isCompactCreate && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="managerId">Project Lead (optional)</Label>
                    <Select value={managerId} onValueChange={handleManagerChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign later" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Assign later</SelectItem>
                        {managers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name}{manager.role ? ` (${manager.role === "TEAMLEADER" ? "TL" : "BA"})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {canAssignLead
                        ? "Leave this empty if you want to create the project first and assign the lead later."
                        : "Select a linked client first. A project lead can only be assigned after the client is selected."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority *</Label>
                    <Select value={projectPriority} onValueChange={(value) => setProjectPriority(value as Priority)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Low</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HIGH">High</SelectItem>
                        <SelectItem value="CRITICAL">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isEditing && (
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={projectStatus} onValueChange={(value) => setProjectStatus(value as ProjectStatus)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PLANNING">Planning</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="ON_HOLD">On Hold</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="estimatedHours">Estimated Hours</Label>
                    <Input
                      id="estimatedHours"
                      name="estimatedHours"
                      type="number"
                      min="0"
                      step="0.5"
                      defaultValue={project?.estimatedHours || ""}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="date"
                      defaultValue={project?.startDate ? new Date(project.startDate).toISOString().split("T")[0] : ""}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      name="deadline"
                      type="date"
                      defaultValue={project?.deadline ? new Date(project.deadline).toISOString().split("T")[0] : ""}
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={project?.description || ""}
                      disabled={isPending}
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update Project" : "Create Project"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                    return;
                  }
                  router.back();
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isClientSearchDialogOpen} onOpenChange={setIsClientSearchDialogOpen}>
        <DialogContent
          className="max-w-[88vw] gap-0 overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-2xl xl:max-w-[1080px]"
          showCloseButton
        >
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-slate-900 sm:text-xl">Search: Customer</DialogTitle>
          </DialogHeader>

          <div className="border-b border-slate-200 px-5 py-3">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex justify-center lg:justify-center">
                <div className="flex w-full max-w-[410px] items-center rounded-md border border-slate-200 bg-slate-50">
                <Search className="ml-3 h-4 w-4 text-slate-400" />
                <Input
                  value={clientQuery}
                  onChange={(event) => {
                    setClientQuery(event.target.value);
                    setClientSearchPage(0);
                  }}
                  placeholder="Search..."
                  className="h-10 border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  className="mr-1 flex h-8 w-8 items-center justify-center rounded-sm border-l border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <span className="text-sm text-slate-600 sm:text-base">
                  {filteredClientOptions.length === 0 ? "0-0 / 0" : `${safeClientSearchPage * clientSearchPageSize + 1}-${Math.min((safeClientSearchPage + 1) * clientSearchPageSize, filteredClientOptions.length)} / ${filteredClientOptions.length}`}
                </span>
                <div className="flex items-center overflow-hidden rounded-sm border border-slate-200">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setClientSearchPage((current) => Math.max(current - 1, 0))}
                    disabled={safeClientSearchPage === 0}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-none border-l border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    onClick={() => setClientSearchPage((current) => Math.min(current + 1, clientSearchTotalPages - 1))}
                    disabled={safeClientSearchPage >= clientSearchTotalPages - 1}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-[500px] overflow-x-auto overflow-y-hidden px-0">
            <div className="min-h-[500px] min-w-fit">
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-slate-50 [&_tr]:border-slate-200">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-14 px-5 text-slate-700" />
                  {activeClientColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className={`px-4 py-3 text-sm font-semibold text-slate-700 ${
                        column.id === "total_due" || column.id === "total_overdue" ? "text-right" : ""
                      }`}
                    >
                      {column.id === "name" ? (
                        <div className="flex items-center justify-between gap-3">
                          <span>{column.label}</span>
                          <ArrowUpDown className="h-4 w-4 text-slate-400" />
                        </div>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="sticky right-0 z-10 w-14 bg-slate-50 px-5 text-right text-slate-700">
                    <Popover open={isClientColumnFilterOpen} onOpenChange={setIsClientColumnFilterOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-sm border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        sideOffset={8}
                        className="w-64 overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-xl"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div
                          className="max-h-[520px] overflow-y-auto overscroll-contain py-3"
                          onWheel={(event) => event.stopPropagation()}
                        >
                          {clientColumnOptions.map((option) => {
                            const checked = selectedClientColumns.includes(option.id);

                            return (
                              <label
                                key={option.id}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => toggleClientColumn(option.id, value === true)}
                                  className="border-slate-300 data-[state=checked]:border-sky-500 data-[state=checked]:bg-sky-500 data-[state=checked]:text-white"
                                />
                                <span>{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClientOptions.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer border-slate-200 bg-white hover:bg-slate-50"
                    onClick={() => handleClientChange(client.id)}
                  >
                    <TableCell className="px-5 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#4b2f81] text-sm font-semibold text-white">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                    </TableCell>
                    {activeClientColumns.map((column) => {
                      const value = getClientColumnValue(client, column.id);
                      const extraClassName = getClientColumnClassName(column.id);
                      const isNumeric = column.id === "total_due" || column.id === "total_overdue";

                      return (
                        <TableCell
                          key={`${client.id}-${column.id}`}
                          className={`${extraClassName} px-4 py-3 text-sm ${isNumeric ? "text-right text-slate-700" : "text-slate-700"}`}
                        >
                          <span className="block truncate">{value}</span>
                        </TableCell>
                      );
                    })}
                    <TableCell className="sticky right-0 bg-white px-5 py-3 text-right">
                      {client.id === clientId ? <Check className="ml-auto h-5 w-5 text-sky-600" /> : null}
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedClientOptions.length === 0 ? (
                  <TableRow className="border-slate-200 bg-white hover:bg-white">
                    <TableCell colSpan={clientTableColumnCount} className="px-5 py-10 text-center text-sm text-slate-500">
                      No customers found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            </div>
          </div>

          <div className="flex items-center justify-end border-t border-slate-200 px-5 py-5">
            <Button
              type="button"
              variant="secondary"
              className="bg-slate-100 text-slate-900 hover:bg-slate-200"
              onClick={() => setIsClientSearchDialogOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
