import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, isValid, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  archiveCrmLead,
  createCrmLead,
  createCrmStage,
  deleteCrmLead,
  deleteCrmStage,
  moveCrmLeadStage,
  reorderCrmStages,
  updateCrmLead,
  updateCrmStage,
  type CrmLeadItem,
  type LeadStage,
} from "@/actions/crm.actions";
import { useCrmPipelineDerivedData } from "./use-crm-pipeline-derived-data";
import {
  getDefaultCustomRule,
  isCustomFilterRuleComplete,
  resolveLeadTitle,
  toErrorMessage,
} from "./crm-pipeline-utils";
import { useLoadingPulse } from "@/components/crm/use-loading-pulse";
import type { CrmPipelineContentProps } from "./crm-pipeline-content";
import type { CrmPipelineDialogsProps } from "./crm-pipeline-dialogs";
import type { CrmPipelineToolbarProps } from "./crm-pipeline-toolbar";
import type {
  ConfirmDialogState,
  CrmPipelineProps,
  CustomFilterRule,
  GroupByDate,
  GroupByField,
  SortMode,
  ViewMode,
} from "./crm-pipeline-types";

const CRM_PIPELINE_FOLDED_STAGES_STORAGE_KEY = "crm-pipeline-folded-stages";

export function useCrmPipelineController({
  leads,
  stages,
  query,
  salesperson,
  clients,
  salesFilter = "all",
  onSalesFilterChange,
}: CrmPipelineProps) {
  const [isPending, startTransition] = useTransition();
  const {
    isActive: isInteractionLoading,
    run: runWithInteractionLoading,
  } = useLoadingPulse();
  const [search, setSearch] = useState(query);
  const [showCreate, setShowCreate] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [editingLead, setEditingLead] = useState<CrmLeadItem | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newValue, setNewValue] = useState("0");
  const [newProbabilityLevel, setNewProbabilityLevel] = useState<1 | 2 | 3>(1);
  const [newNotes, setNewNotes] = useState("");
  const [pipelineLeads, setPipelineLeads] = useState<CrmLeadItem[]>(leads);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [visibleStageKeys, setVisibleStageKeys] = useState<LeadStage[]>(() => stages.map((stage) => stage.key));
  const [stageLabels, setStageLabels] = useState<Record<string, string>>(() =>
    stages.reduce<Record<string, string>>((acc, stage) => {
      acc[stage.key] = stage.label;
      return acc;
    }, {})
  );
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [newStageLabel, setNewStageLabel] = useState("");
  const [stageFilters, setStageFilters] = useState<LeadStage[]>([]);
  const [myPipelineOnly, setMyPipelineOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [openOpportunitiesOnly, setOpenOpportunitiesOnly] = useState(false);
  const [requireEmail, setRequireEmail] = useState(false);
  const [requirePhone, setRequirePhone] = useState(false);
  const [highProbabilityOnly, setHighProbabilityOnly] = useState(false);
  const [noValueOnly, setNoValueOnly] = useState(false);
  const [customFilterRules, setCustomFilterRules] = useState<CustomFilterRule[]>([]);
  const [customFilterMode, setCustomFilterMode] = useState<"any" | "all">("any");
  const [customIncludeArchived, setCustomIncludeArchived] = useState(false);
  const [showCustomFilterDialog, setShowCustomFilterDialog] = useState(false);
  const [draftCustomFilterRules, setDraftCustomFilterRules] = useState<CustomFilterRule[]>([getDefaultCustomRule()]);
  const [draftCustomFilterMode, setDraftCustomFilterMode] = useState<"any" | "all">("any");
  const [draftCustomIncludeArchived, setDraftCustomIncludeArchived] = useState(false);
  const [groupByField, setGroupByField] = useState<GroupByField>("stage");
  const [groupByDate, setGroupByDate] = useState<GroupByDate>("creation");
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const addStagePanelRef = useRef<HTMLDivElement>(null);
  const kanbanAutoScrollFrameRef = useRef<number | null>(null);
  const [editingStageKey, setEditingStageKey] = useState<LeadStage | null>(null);
  const [editingStageLabel, setEditingStageLabel] = useState("");
  const [foldedStages, setFoldedStages] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") {
      return {};
    }

    const storedValue = window.localStorage.getItem(CRM_PIPELINE_FOLDED_STAGES_STORAGE_KEY);
    if (!storedValue) {
      return {};
    }

    try {
      const parsed = JSON.parse(storedValue);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }

      return Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"
        )
      );
    } catch {
      window.localStorage.removeItem(CRM_PIPELINE_FOLDED_STAGES_STORAGE_KEY);
      return {};
    }
  });
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [deleteConfirmState, setDeleteConfirmState] = useState<ConfirmDialogState | null>(null);
  const [archiveConfirmState, setArchiveConfirmState] = useState<ConfirmDialogState | null>(null);
  const [stageDeleteConfirmKey, setStageDeleteConfirmKey] = useState<LeadStage | null>(null);
  const [activityOpenLeadId, setActivityOpenLeadId] = useState<string | null>(null);
  const [salespersonLead, setSalespersonLead] = useState<CrmLeadItem | null>(null);
  const [draggingStageKey, setDraggingStageKey] = useState<LeadStage | null>(null);
  const [draggingType, setDraggingType] = useState<"lead" | "stage" | null>(null);

  const runWithLoading = (action: () => void | Promise<void>) => {
    runWithInteractionLoading(action);
  };

  const runWithLoadingTransition = (action: () => Promise<void>) => {
    runWithLoading(
      () =>
        new Promise<void>((resolve) => {
          startTransition(async () => {
            try {
              await action();
            } finally {
              resolve();
            }
          });
        })
    );
  };

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawViewMode = searchParams.get("view");
  const viewMode: ViewMode =
    rawViewMode === "list" || rawViewMode === "calendar" ? rawViewMode : "kanban";
  const rawCalendarDate = searchParams.get("calendarDate");
  const calendarDate = useMemo(() => {
    if (!rawCalendarDate) return new Date();
    const parsed = parseISO(rawCalendarDate);
    return isValid(parsed) ? parsed : new Date();
  }, [rawCalendarDate]);
  const calendarLeadId = searchParams.get("calendarLeadId");

  const currency = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
      }),
    []
  );

  const shortCurrency = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 1,
        notation: "compact",
        compactDisplay: "short",
      }),
    []
  );

  const {
    activeSearchChips,
    filteredLeads,
    groupedBySelectedField,
    isStageGrouping,
    orderedLeads,
    stageThemeByKey,
    visibleStages,
  } = useCrmPipelineDerivedData({
    leads: pipelineLeads,
    clients,
    salesperson,
    salesFilter,
    search,
    sortMode,
    groupByField,
    groupByDate,
    stageLabels,
    visibleStageKeys,
    stageFilters,
    myPipelineOnly,
    unassignedOnly,
    openOpportunitiesOnly,
    requireEmail,
    requirePhone,
    highProbabilityOnly,
    noValueOnly,
    customFilterRules,
    customFilterMode,
    customIncludeArchived,
  });

  useEffect(() => {
    setPipelineLeads(leads);
  }, [leads]);

  useEffect(() => {
    const validStageKeys = new Set(stages.map((stage) => stage.key));
    setFoldedStages((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([stageKey, isFolded]) => validStageKeys.has(stageKey as LeadStage) && isFolded)
      );

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [stages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (Object.keys(foldedStages).length === 0) {
      window.localStorage.removeItem(CRM_PIPELINE_FOLDED_STAGES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CRM_PIPELINE_FOLDED_STAGES_STORAGE_KEY, JSON.stringify(foldedStages));
  }, [foldedStages]);

  useEffect(() => {
    return () => {
      if (kanbanAutoScrollFrameRef.current !== null) {
        cancelAnimationFrame(kanbanAutoScrollFrameRef.current);
      }
    };
  }, []);

  const visibleSelectedLeadIds = useMemo(() => {
    const visible = new Set(filteredLeads.map((lead) => lead.id));
    return selectedLeadIds.filter((id) => visible.has(id));
  }, [filteredLeads, selectedLeadIds]);

  const allLeadsSelected = filteredLeads.length > 0 && visibleSelectedLeadIds.length === filteredLeads.length;

  const replaceCurrentSearchParams = (
    mutate: (params: URLSearchParams) => void,
    options: { scroll?: boolean } = {}
  ) => {
    runWithLoading(() => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextUrl, { scroll: options.scroll ?? false });
    });
  };

  const openLeadDetails = (leadId: string) => {
    runWithLoading(() => {
      const currentQuery = searchParams.toString();
      const currentPageHref = currentQuery ? `${pathname}?${currentQuery}` : pathname;
      const params = new URLSearchParams();
      params.set("from", currentPageHref);
      router.push(`/crm/${leadId}?${params.toString()}`);
    });
  };

  const updateQuery = (value: string) => {
    runWithLoading(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set("q", value);
      else params.delete("q");
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery(search.trim());
  };

  const handleOpenCustomFilterDialog = () => {
    setDraftCustomFilterMode(customFilterMode);
    setDraftCustomIncludeArchived(customIncludeArchived);
    setDraftCustomFilterRules(customFilterRules.length > 0 ? customFilterRules : [getDefaultCustomRule()]);
    setShowCustomFilterDialog(true);
  };

  const handleDiscardCustomFilter = () => {
    setDraftCustomFilterMode(customFilterMode);
    setDraftCustomIncludeArchived(customIncludeArchived);
    setDraftCustomFilterRules(customFilterRules.length > 0 ? customFilterRules : [getDefaultCustomRule()]);
    setShowCustomFilterDialog(false);
  };

  const handleApplyCustomFilter = () => {
    runWithLoading(() => {
      setCustomFilterMode(draftCustomFilterMode);
      setCustomIncludeArchived(draftCustomIncludeArchived);
      setCustomFilterRules(draftCustomFilterRules.filter(isCustomFilterRuleComplete));
      setShowCustomFilterDialog(false);
    });
  };

  const updateDraftCustomRule = (id: string, patch: Partial<CustomFilterRule>) => {
    setDraftCustomFilterRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    );
  };

  const removeDraftCustomRule = (id: string) => {
    setDraftCustomFilterRules((current) => {
      const next = current.filter((rule) => rule.id !== id);
      return next.length > 0 ? next : [getDefaultCustomRule()];
    });
  };

  const addDraftCustomRule = () => {
    setDraftCustomFilterRules((current) => [...current, getDefaultCustomRule()]);
  };

  const handleCreate = async (formData: FormData) => {
    const trimmedClientName = newClientName.trim();
    if (!trimmedClientName) {
      throw new Error("Select or create a client first");
    }

    formData.set("clientName", trimmedClientName);
    formData.set("title", resolveLeadTitle(newClientName, newEmail));
    formData.set("email", newEmail);
    formData.set("phone", newPhone);
    formData.set("value", newValue);
    formData.set("probabilityLevel", String(newProbabilityLevel));
    formData.set("notes", newNotes);

    const result = await createCrmLead(formData);
    if (result.error) {
      throw new Error(toErrorMessage(result.error));
    }

    toast.success("Lead created");
    setShowCreate(false);
    setNewClientName("");
    setNewEmail("");
    setNewPhone("");
    setNewValue("0");
    setNewProbabilityLevel(1);
    setNewNotes("");
    window.setTimeout(() => {
      router.refresh();
    }, 0);
  };

  const onClientNameChange = (value: string) => {
    setNewClientName(value);
    const matched = clients.find((client) => client.name.toLowerCase() === value.trim().toLowerCase());
    if (!matched) return;

    setNewEmail(matched.email || "");
    setNewPhone(matched.phone || "");
  };

  const handleRequestDelete = (ids: string[]) => {
    if (ids.length === 0) return;

    const matchingLeads = pipelineLeads.filter((lead) => ids.includes(lead.id));
    const primaryLead = matchingLeads[0];
    setDeleteConfirmState({
      ids,
      title:
        ids.length === 1
          ? `Delete "${primaryLead?.title || primaryLead?.clientName || "this lead"}"?`
          : `Delete ${ids.length} selected leads?`,
      detail:
        ids.length === 1
          ? "This action permanently removes the lead details and cannot be undone."
          : "This action permanently removes all selected lead details and cannot be undone.",
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmState || deleteConfirmState.ids.length === 0) return;
    const ids = deleteConfirmState.ids;

    runWithLoadingTransition(async () => {
      let deletedCount = 0;
      for (const id of ids) {
        const result = await deleteCrmLead(id);
        if (result.error) {
          toast.error(toErrorMessage(result.error));
          continue;
        }
        deletedCount += 1;
      }

      setDeleteConfirmState(null);
      setSelectedLeadIds((current) => current.filter((id) => !ids.includes(id)));
      toast.success(deletedCount === 1 ? "Lead moved to deleted page" : `${deletedCount} leads moved to deleted page`);
      router.refresh();
    });
  };

  const handleRequestArchive = (ids: string[]) => {
    if (ids.length === 0) return;

    const matchingLeads = pipelineLeads.filter((lead) => ids.includes(lead.id));
    const primaryLead = matchingLeads[0];
    setArchiveConfirmState({
      ids,
      title:
        ids.length === 1
          ? `Archive "${primaryLead?.title || primaryLead?.clientName || "this lead"}"?`
          : `Archive ${ids.length} selected leads?`,
      detail:
        ids.length === 1
          ? "This action will move the selected lead details to the archive page."
          : "This action will move all selected lead details to the archive page.",
    });
  };

  const handleConfirmArchive = () => {
    if (!archiveConfirmState || archiveConfirmState.ids.length === 0) return;
    const ids = archiveConfirmState.ids;

    runWithLoadingTransition(async () => {
      let archivedCount = 0;
      for (const id of ids) {
        const result = await archiveCrmLead(id);
        if (result.error) {
          toast.error(toErrorMessage(result.error));
          continue;
        }
        archivedCount += 1;
      }

      setArchiveConfirmState(null);
      setSelectedLeadIds((current) => current.filter((id) => !ids.includes(id)));
      toast.success(archivedCount === 1 ? "Lead moved to archive page" : `${archivedCount} leads moved to archive page`);
      router.refresh();
    });
  };

  const handleUpdate = (lead: CrmLeadItem, formData: FormData) => {
    runWithLoadingTransition(async () => {
      const result = await updateCrmLead(lead.id, formData);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }

      toast.success("Lead updated");
      setEditingLead(null);
      router.refresh();
    });
  };

  const openReporting = () => {
    runWithLoading(() => {
      router.push("/crm/reporting");
    });
  };

  const openMap = () => {
    const lead = pipelineLeads[0];
    if (!lead || !lead.clientName) {
      toast.error("No handled person name available for map");
      return;
    }

    const queryValue = encodeURIComponent(lead.clientName);
    window.open(`https://www.google.com/maps/search/?api=1&query=${queryValue}`, "_blank");
  };

  const handleViewModeChange = (nextView: ViewMode) => {
    replaceCurrentSearchParams((params) => {
      if (nextView === "kanban") {
        params.delete("view");
      } else {
        params.set("view", nextView);
      }

      if (nextView === "calendar" && !params.get("calendarDate")) {
        params.set("calendarDate", format(new Date(), "yyyy-MM-dd"));
      }

      if (nextView !== "calendar") {
        params.delete("calendarLeadId");
      }
    });
    setSelectedLeadIds([]);
  };

  const handleCalendarDateChange = (nextDate: Date) => {
    replaceCurrentSearchParams((params) => {
      params.set("calendarDate", format(nextDate, "yyyy-MM-dd"));
      params.delete("calendarLeadId");
    });
  };

  const handleOpenAddStageInput = () => {
    setShowAddStageInput(true);
  };

  const handleConfirmAddStage = () => {
    const nextLabel = newStageLabel.trim();
    if (!nextLabel) {
      toast.error("Stage name is required");
      return;
    }

    runWithLoadingTransition(async () => {
      const result = await createCrmStage(nextLabel);
      if (result.error || !result.data) {
        toast.error(toErrorMessage(result.error));
        return;
      }

      setVisibleStageKeys((current) => [...current, result.data.key]);
      setStageLabels((current) => ({ ...current, [result.data.key]: result.data.label }));
      setNewStageLabel("");
      setShowAddStageInput(false);
      toast.success(`${result.data.label} stage added`);
      router.refresh();
    });
  };

  const handleCancelAddStage = () => {
    setNewStageLabel("");
    setShowAddStageInput(false);
  };

  useEffect(() => {
    if (!showAddStageInput) return;
    const scroller = kanbanScrollRef.current;
    if (!scroller) return;

    requestAnimationFrame(() => {
      scroller.scrollTo({
        left: scroller.scrollWidth,
        behavior: "smooth",
      });
    });
  }, [showAddStageInput]);

  const handleStartEditStage = (stageKey: LeadStage) => {
    setEditingStageKey(stageKey);
    setEditingStageLabel(stageLabels[stageKey]);
  };

  const handleSaveStageLabel = () => {
    if (!editingStageKey) return;
    const next = editingStageLabel.trim();
    if (!next) {
      toast.error("Stage name is required");
      return;
    }

    runWithLoadingTransition(async () => {
      const result = await updateCrmStage(editingStageKey, next);
      if (result.error || !result.data) {
        toast.error(toErrorMessage(result.error));
        return;
      }

      setStageLabels((current) => ({ ...current, [editingStageKey]: result.data.label }));
      setEditingStageKey(null);
      setEditingStageLabel("");
      toast.success("Stage updated");
      router.refresh();
    });
  };

  const handleCancelEditStage = () => {
    setEditingStageKey(null);
    setEditingStageLabel("");
  };

  const handleToggleFoldStage = (stageKey: LeadStage) => {
    setFoldedStages((current) => ({ ...current, [stageKey]: !current[stageKey] }));
  };

  const handleDeleteStage = (stageKey: LeadStage) => {
    if (visibleStageKeys.length <= 1) {
      toast.error("At least one stage must remain");
      return;
    }

    runWithLoadingTransition(async () => {
      const result = await deleteCrmStage(stageKey);
      if (result.error) {
        toast.error(toErrorMessage(result.error));
        return;
      }

      setVisibleStageKeys((current) => current.filter((key) => key !== stageKey));
      if (editingStageKey === stageKey) {
        setEditingStageKey(null);
        setEditingStageLabel("");
      }

      toast.success(`${stageLabels[stageKey] || stageKey} stage removed`);
      router.refresh();
    });
  };

  const handleConfirmDeleteStage = () => {
    if (!stageDeleteConfirmKey) return;
    handleDeleteStage(stageDeleteConfirmKey);
    setStageDeleteConfirmKey(null);
  };

  const handleDropToStage = (targetStage: LeadStage) => {
    if (!draggingLeadId) return;

    const lead = pipelineLeads.find((item) => item.id === draggingLeadId);
    if (!lead || lead.stage === targetStage) {
      setDraggingLeadId(null);
      setDragOverStage(null);
      setDraggingType(null);
      return;
    }

    const previousLeads = pipelineLeads;
    setPipelineLeads((current) =>
      current.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              stage: targetStage,
              updatedAt: new Date(),
            }
          : item
      )
    );
    setDraggingLeadId(null);
    setDragOverStage(null);
    setDraggingType(null);

    runWithLoadingTransition(async () => {
      const result = await moveCrmLeadStage(lead.id, targetStage);
      if (result.error) {
        setPipelineLeads(previousLeads);
        toast.error(toErrorMessage(result.error));
      } else {
        setPipelineLeads((current) =>
          current.map((item) => (item.id === lead.id ? { ...item, ...result.data } : item))
        );
      }
    });
  };

  const handleStageDropReorder = (targetStageKey: LeadStage) => {
    if (!draggingStageKey || draggingStageKey === targetStageKey) return;

    const previousOrder = visibleStageKeys;
    const nextOrder = (() => {
      const current = [...visibleStageKeys];
      const fromIndex = current.indexOf(draggingStageKey);
      const toIndex = current.indexOf(targetStageKey);
      if (fromIndex === -1 || toIndex === -1) return current;
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, draggingStageKey);
      return current;
    })();

    setVisibleStageKeys(nextOrder);
    setDraggingStageKey(null);
    setDragOverStage(null);
    setDraggingType(null);

    runWithLoadingTransition(async () => {
      const result = await reorderCrmStages(nextOrder);
      if (result.error) {
        setVisibleStageKeys(previousOrder);
        toast.error(toErrorMessage(result.error));
        return;
      }
    });
  };

  const handleStageDrop = (stageKey: LeadStage) => {
    if (!isStageGrouping) return;
    if (draggingType === "lead") {
      handleDropToStage(stageKey);
      return;
    }
    handleStageDropReorder(stageKey);
  };

  const handleStageDragStart = (stageKey: LeadStage) => {
    if (!isStageGrouping) return;
    setDraggingStageKey(stageKey);
    setDraggingType("stage");
  };

  const handleLeadDragStart = (leadId: string) => {
    if (!isStageGrouping) return;
    setDraggingLeadId(leadId);
    setDraggingType("lead");
  };

  const handleDragEnd = () => {
    setDraggingLeadId(null);
    setDraggingStageKey(null);
    setDragOverStage(null);
    setDraggingType(null);
  };

  const handleStageDragOver = (stageKey: LeadStage) => {
    if (!isStageGrouping) return;
    setDragOverStage(stageKey);
  };

  const handleKanbanDragOver = (clientX: number) => {
    if (!isStageGrouping) return;
    const scroller = kanbanScrollRef.current;
    if (!scroller) return;

    const rect = scroller.getBoundingClientRect();
    const edgeThreshold = 96;
    const maxStep = 28;
    let delta = 0;

    if (clientX < rect.left + edgeThreshold) {
      const intensity = 1 - (clientX - rect.left) / edgeThreshold;
      delta = -Math.max(12, Math.round(maxStep * intensity));
    } else if (clientX > rect.right - edgeThreshold) {
      const intensity = 1 - (rect.right - clientX) / edgeThreshold;
      delta = Math.max(12, Math.round(maxStep * intensity));
    }

    if (delta === 0 || kanbanAutoScrollFrameRef.current !== null) return;

    kanbanAutoScrollFrameRef.current = requestAnimationFrame(() => {
      scroller.scrollLeft += delta;
      kanbanAutoScrollFrameRef.current = null;
    });
  };

  const handleStageDragLeave = (stageKey: LeadStage) => {
    if (!isStageGrouping) return;
    setDragOverStage((current) => (current === stageKey ? null : current));
  };

  const toggleActivityCard = (leadId: string) => {
    setActivityOpenLeadId((current) => (current === leadId ? null : leadId));
  };

  const handleScheduleActivity = (lead: CrmLeadItem) => {
    const scheduledDate = lead.expectedClosingDate || lead.createdAt;
    replaceCurrentSearchParams((params) => {
      params.set("view", "calendar");
      params.set("calendarDate", format(new Date(scheduledDate), "yyyy-MM-dd"));
      params.set("calendarLeadId", lead.id);
    });
    toast.success(`Opened calendar schedule for ${lead.title || lead.clientName || "opportunity"}`);
  };

  const handleStageFilterChange = (stageKey: LeadStage, checked: boolean) => {
    runWithLoading(() => {
      if (checked) {
        setStageFilters((current) => (current.includes(stageKey) ? current : [...current, stageKey]));
        return;
      }
      setStageFilters((current) => current.filter((key) => key !== stageKey));
    });
  };

  const handleToggleAllLeadsSelection = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(filteredLeads.map((lead) => lead.id));
      return;
    }
    setSelectedLeadIds([]);
  };

  const handleToggleLeadSelection = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedLeadIds((current) => [...current, leadId]);
      return;
    }
    setSelectedLeadIds((current) => current.filter((id) => id !== leadId));
  };

  const handleBulkDelete = () => {
    if (visibleSelectedLeadIds.length === 0) return;
    handleRequestDelete(visibleSelectedLeadIds);
  };

  const handleBulkArchive = () => {
    if (visibleSelectedLeadIds.length === 0) return;
    handleRequestArchive(visibleSelectedLeadIds);
  };

  const handleRemoveActiveChip = (chipId: string) => {
    runWithLoading(() => {
      if (chipId.startsWith("stage:")) {
        const stageKey = chipId.replace("stage:", "") as LeadStage;
        setStageFilters((current) => current.filter((key) => key !== stageKey));
        return;
      }
      if (chipId.startsWith("sales:")) {
        onSalesFilterChange?.("all");
        return;
      }
      if (chipId === "has_email") {
        setRequireEmail(false);
        return;
      }
      if (chipId === "has_phone") {
        setRequirePhone(false);
        return;
      }
      if (chipId === "high_probability") {
        setHighProbabilityOnly(false);
        return;
      }
      if (chipId === "no_value") {
        setNoValueOnly(false);
        return;
      }
      if (chipId === "group_by") {
        setGroupByField("stage");
        return;
      }
      if (chipId === "my_pipeline") {
        setMyPipelineOnly(false);
        return;
      }
      if (chipId === "unassigned") {
        setUnassignedOnly(false);
        return;
      }
      if (chipId === "open_opportunities") {
        setOpenOpportunitiesOnly(false);
        return;
      }
      if (chipId === "include_archived") {
        setCustomIncludeArchived(false);
        return;
      }
      if (chipId.startsWith("custom:")) {
        const ruleId = chipId.replace("custom:", "");
        setCustomFilterRules((current) => current.filter((rule) => rule.id !== ruleId));
      }
    });
  };

  const handleClearAllSearchOptions = () => {
    runWithLoading(() => {
      setStageFilters([]);
      setRequireEmail(false);
      setRequirePhone(false);
      setHighProbabilityOnly(false);
      setNoValueOnly(false);
      setMyPipelineOnly(false);
      setUnassignedOnly(false);
      setOpenOpportunitiesOnly(false);
      setSortMode("recent");
      setSearch("");
      setCustomFilterRules([]);
      setCustomFilterMode("any");
      setCustomIncludeArchived(false);
      setDraftCustomFilterRules([getDefaultCustomRule()]);
      setDraftCustomFilterMode("any");
      setDraftCustomIncludeArchived(false);
    });
  };

  const toolbarProps: CrmPipelineToolbarProps = {
    isPending,
    clients,
    showCreate,
    onShowCreateChange: setShowCreate,
    onCreateLead: handleCreate,
    newClientName,
    newEmail,
    newPhone,
    newValue,
    newProbabilityLevel,
    newNotes,
    onClientNameChange,
    onEmailChange: setNewEmail,
    onPhoneChange: setNewPhone,
    onValueChange: setNewValue,
    onProbabilityChange: setNewProbabilityLevel,
    onNotesChange: setNewNotes,
    viewMode,
    onViewModeChange: handleViewModeChange,
    showStats,
    onToggleStats: () => {
      runWithLoading(() => {
        setShowStats((value) => !value);
      });
    },
    onOpenReporting: openReporting,
    onOpenMap: openMap,
    onRefresh: () => {
      runWithLoading(() => {
        router.refresh();
      });
    },
    search,
    onSearchChange: setSearch,
    onSearchSubmit: handleSearchSubmit,
    activeSearchChips,
    onRemoveActiveChip: handleRemoveActiveChip,
    visibleStages,
    stageFilters,
    onStageFilterChange: handleStageFilterChange,
    onOpenCustomFilterDialog: handleOpenCustomFilterDialog,
    onClearStageFilters: () => {
      runWithLoading(() => {
        setStageFilters([]);
      });
    },
    myPipelineOnly,
    onToggleMyPipeline: () => {
      runWithLoading(() => {
        setMyPipelineOnly((current) => {
          const next = !current;
          if (next) setUnassignedOnly(false);
          return next;
        });
      });
    },
    unassignedOnly,
    onToggleUnassigned: () => {
      runWithLoading(() => {
        setUnassignedOnly((current) => {
          const next = !current;
          if (next) setMyPipelineOnly(false);
          return next;
        });
      });
    },
    openOpportunitiesOnly,
    onToggleOpenOpportunities: () => {
      runWithLoading(() => {
        setOpenOpportunitiesOnly((current) => !current);
      });
    },
    groupByField,
    onGroupByFieldChange: (value) => {
      runWithLoading(() => {
        setGroupByField(value);
      });
    },
    groupByDate,
    onGroupByDateChange: (value) => {
      runWithLoading(() => {
        setGroupByDate(value);
      });
    },
    sortMode,
    onSortModeChange: (value) => {
      runWithLoading(() => {
        setSortMode(value);
      });
    },
    onClearAllSearchOptions: handleClearAllSearchOptions,
    onOpenArchivePage: () => {
      runWithLoading(() => {
        router.push("/crm/archive");
      });
    },
    onOpenDeletedPage: () => {
      runWithLoading(() => {
        router.push("/crm/deleted");
      });
    },
    visibleSelectedCount: visibleSelectedLeadIds.length,
    onBulkArchive: handleBulkArchive,
    onBulkDelete: handleBulkDelete,
  };

  const contentProps: CrmPipelineContentProps = {
    viewMode,
    showStats,
    groupedBySelectedField,
    clients,
    allLeadsSelected,
    filteredLeads,
    orderedLeads,
    visibleSelectedLeadIds,
    calendarDate,
    calendarLeadId,
    stageLabels,
    currency,
    shortCurrency,
    isStageGrouping,
    foldedStages,
    stageThemeByKey,
    draggingLeadId,
    dragOverStage,
    editingStageKey,
    editingStageLabel,
    showAddStageInput,
    newStageLabel,
    activityOpenLeadId,
    kanbanScrollRef,
    addStagePanelRef,
    onToggleAllLeadsSelection: handleToggleAllLeadsSelection,
    onToggleLeadSelection: handleToggleLeadSelection,
    onOpenLeadDetails: openLeadDetails,
    onEditLead: setEditingLead,
    onRequestDelete: handleRequestDelete,
    onOpenCreate: () => setShowCreate(true),
    onShowAddStageInput: handleOpenAddStageInput,
    onStageDragStart: handleStageDragStart,
    onLeadDragStart: handleLeadDragStart,
    onDragEnd: handleDragEnd,
    onStageDragOver: handleStageDragOver,
    onKanbanDragOver: handleKanbanDragOver,
    onStageDragLeave: handleStageDragLeave,
    onStageDrop: handleStageDrop,
    onEditingStageLabelChange: setEditingStageLabel,
    onSaveStageLabel: handleSaveStageLabel,
    onCancelEditStage: handleCancelEditStage,
    onStartEditStage: handleStartEditStage,
    onToggleFoldStage: handleToggleFoldStage,
    onRequestDeleteStage: setStageDeleteConfirmKey,
    onNewStageLabelChange: setNewStageLabel,
    onConfirmAddStage: handleConfirmAddStage,
    onCancelAddStage: handleCancelAddStage,
    onToggleActivityCard: toggleActivityCard,
    onScheduleActivity: handleScheduleActivity,
    onCalendarDateChange: handleCalendarDateChange,
    onShowSalespersonLead: setSalespersonLead,
  };

  const dialogProps: CrmPipelineDialogsProps = {
    showCustomFilterDialog,
    onDiscardCustomFilter: handleDiscardCustomFilter,
    draftCustomFilterMode,
    onDraftCustomFilterModeChange: setDraftCustomFilterMode,
    draftCustomIncludeArchived,
    onDraftCustomIncludeArchivedChange: setDraftCustomIncludeArchived,
    draftCustomFilterRules,
    onUpdateDraftCustomRule: updateDraftCustomRule,
    onRemoveDraftCustomRule: removeDraftCustomRule,
    onAddDraftCustomRule: addDraftCustomRule,
    onApplyCustomFilter: handleApplyCustomFilter,
    editingLead,
    onEditingLeadChange: setEditingLead,
    onUpdateLead: handleUpdate,
    visibleStages,
    stageLabels,
    salespersonLead,
    onSalespersonLeadChange: setSalespersonLead,
    deleteConfirmState,
    onDeleteConfirmStateChange: setDeleteConfirmState,
    onConfirmDelete: handleConfirmDelete,
    archiveConfirmState,
    onArchiveConfirmStateChange: setArchiveConfirmState,
    onConfirmArchive: handleConfirmArchive,
    stageDeleteConfirmKey,
    onStageDeleteConfirmKeyChange: setStageDeleteConfirmKey,
    onConfirmDeleteStage: handleConfirmDeleteStage,
    isPending,
  };

  return {
    contentProps,
    dialogProps,
    toolbarProps,
    isBusy: isPending || isInteractionLoading,
  };
}
