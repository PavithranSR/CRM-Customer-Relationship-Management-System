import { useCallback, useMemo } from "react";
import type { CrmLeadItem, LeadStage } from "@/actions/crm.actions";
import type { CrmSalesFilterKey } from "@/components/crm/crm-module-top-nav";
import {
  CUSTOM_FILTER_FIELDS,
  GROUP_BY_LABELS,
  SALES_FILTER_LABELS,
  STAGE_THEMES,
} from "./crm-pipeline-config";
import {
  isCustomFilterRuleComplete,
  normalizePhone,
  normalizeText,
} from "./crm-pipeline-utils";
import { readPipelineTagValue } from "./crm-pipeline-derived-data-helpers";
import type {
  CrmPipelineProps,
  CustomFilterField,
  CustomFilterRule,
  GroupByDate,
  GroupByField,
  GroupedPipelineStage,
  SearchChip,
  SortMode,
  VisibleStage,
} from "./crm-pipeline-types";

interface UseCrmPipelineDerivedDataParams {
  leads: CrmLeadItem[];
  clients: CrmPipelineProps["clients"];
  salesperson: CrmPipelineProps["salesperson"];
  salesFilter: CrmSalesFilterKey;
  search: string;
  sortMode: SortMode;
  groupByField: GroupByField;
  groupByDate: GroupByDate;
  stageLabels: Record<string, string>;
  visibleStageKeys: LeadStage[];
  stageFilters: LeadStage[];
  myPipelineOnly: boolean;
  unassignedOnly: boolean;
  openOpportunitiesOnly: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  highProbabilityOnly: boolean;
  noValueOnly: boolean;
  customFilterRules: CustomFilterRule[];
  customFilterMode: "any" | "all";
  customIncludeArchived: boolean;
}

export function useCrmPipelineDerivedData({
  leads,
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
}: UseCrmPipelineDerivedDataParams) {
  const visibleStages = useMemo<VisibleStage[]>(
    () =>
      visibleStageKeys
        .map((key) => ({ key, label: stageLabels[key] || key }))
        .filter((stage): stage is VisibleStage => Boolean(stage)),
    [visibleStageKeys, stageLabels]
  );

  const stagesForBoard = useMemo(
    () =>
      stageFilters.length > 0
        ? visibleStages.filter((stage) => stageFilters.includes(stage.key))
        : visibleStages,
    [visibleStages, stageFilters]
  );

  const clientsByEmail = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizeText(client.email);
      if (key) map.set(key, client);
    });
    return map;
  }, [clients]);

  const clientsByPhone = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizePhone(client.phone);
      if (key) map.set(key, client);
    });
    return map;
  }, [clients]);

  const clientsByName = useMemo(() => {
    const map = new Map<string, CrmPipelineProps["clients"][number]>();
    clients.forEach((client) => {
      const key = normalizeText(client.name);
      if (key && !map.has(key)) map.set(key, client);
    });
    return map;
  }, [clients]);

  const findMatchingClient = useCallback(
    (lead: CrmLeadItem) => {
      const byEmail = clientsByEmail.get(normalizeText(lead.email));
      if (byEmail) return byEmail;

      const byPhone = clientsByPhone.get(normalizePhone(lead.phone));
      if (byPhone) return byPhone;

      return clientsByName.get(normalizeText(lead.clientName || lead.title));
    },
    [clientsByEmail, clientsByPhone, clientsByName]
  );

  const getLeadLocationValue = useCallback(
    (lead: CrmLeadItem, field: "city" | "country") => {
      const fromTags = readPipelineTagValue(lead.tags, field).trim();
      if (fromTags) return fromTags;

      const matchedClient = findMatchingClient(lead);
      return (matchedClient?.[field] || "").trim();
    },
    [findMatchingClient]
  );

  const getRuleFieldValue = useCallback(
    (lead: CrmLeadItem, field: CustomFilterField) => {
      if (field === "country") return getLeadLocationValue(lead, "country");
      if (field === "city") return getLeadLocationValue(lead, "city");
      if (field === "stage") return stageLabels[lead.stage] || lead.stage || "";
      if (field === "salesperson") return lead.createdByName || lead.createdByEmail || "";
      if (field === "email") return lead.email || "";
      if (field === "phone") return lead.phone || "";
      if (field === "client") return lead.clientName || lead.title || "";
      if (field === "value") return lead.value ?? 0;
      return lead.probabilityLevel ?? 0;
    },
    [getLeadLocationValue, stageLabels]
  );

  const doesRuleMatch = useCallback(
    (lead: CrmLeadItem, rule: CustomFilterRule) => {
      const fieldValue = getRuleFieldValue(lead, rule.field);
      if (rule.operator === "is_set") return String(fieldValue).trim().length > 0;
      if (rule.operator === "is_not_set") return String(fieldValue).trim().length === 0;

      if (rule.field === "value" || rule.field === "probability") {
        const source = Number(fieldValue || 0);
        const target = Number(rule.value || 0);
        if (Number.isNaN(target)) return false;
        if (rule.operator === "equals") return source === target;
        if (rule.operator === "gt") return source > target;
        if (rule.operator === "lt") return source < target;
        return String(source).includes(rule.value.trim());
      }

      const source = String(fieldValue || "").toLowerCase();
      const target = rule.value.trim().toLowerCase();
      if (rule.operator === "equals") return source === target;
      if (rule.operator === "contains") return source.includes(target);
      if (rule.operator === "gt") return source > target;
      if (rule.operator === "lt") return source < target;
      return false;
    },
    [getRuleFieldValue]
  );

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const currentUserEmail = salesperson.email.trim().toLowerCase();
    const activeCustomRules = customFilterRules.filter(isCustomFilterRuleComplete);

    return leads.filter((lead) => {
      const stageName = (stageLabels[lead.stage] || lead.stage || "").toLowerCase();
      const isArchived = stageName.includes("archived") || stageName.includes("deleted");
      const isClosed = stageName.includes("won") || stageName.includes("lost");
      const sameCreatorId = Boolean(salesperson.id) && lead.createdById === salesperson.id;
      const creatorEmail = (lead.createdByEmail || "").trim().toLowerCase();
      const sameCreatorEmail =
        Boolean(currentUserEmail) &&
        creatorEmail.length > 0 &&
        creatorEmail === currentUserEmail;
      const isCurrentUserLead = sameCreatorId || sameCreatorEmail;

      const matchesSalesFilter = (() => {
        if (salesFilter === "all") return true;
        if (salesFilter === "my_pipeline") return isCurrentUserLead;
        if (salesFilter === "my_quotations") return (lead.quotationTotal ?? 0) > 0;
        if (salesFilter === "orders") {
          return (lead.paidAmount ?? 0) > 0 || (lead.balanceAmount ?? 0) > 0 || (lead.finalAmount ?? 0) > 0;
        }
        if (salesFilter === "teams") {
          return (lead.createdByRole || "").toLowerCase().includes("team");
        }
        if (salesFilter === "customers") {
          return Boolean((lead.clientName || "").trim());
        }
        return true;
      })();

      if (!customIncludeArchived && isArchived) return false;
      if ((myPipelineOnly || salesFilter === "my_pipeline") && !isCurrentUserLead) return false;
      if (!matchesSalesFilter) return false;
      if (unassignedOnly && lead.createdById) return false;
      if (openOpportunitiesOnly && isClosed) return false;
      if (stageFilters.length > 0 && !stageFilters.includes(lead.stage)) return false;
      if (requireEmail && !lead.email) return false;
      if (requirePhone && !lead.phone) return false;
      if (highProbabilityOnly && (lead.probabilityLevel ?? 1) < 3) return false;
      if (noValueOnly && (lead.value ?? 0) > 0) return false;

      if (activeCustomRules.length > 0) {
        const matches = activeCustomRules.map((rule) => doesRuleMatch(lead, rule));
        const passesCustomFilter =
          customFilterMode === "all" ? matches.every(Boolean) : matches.some(Boolean);
        if (!passesCustomFilter) return false;
      }

      if (!term) return true;

      return [
        lead.title,
        lead.clientName,
        lead.email,
        lead.phone,
        stageLabels[lead.stage] || lead.stage,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [
    customFilterMode,
    customFilterRules,
    customIncludeArchived,
    doesRuleMatch,
    highProbabilityOnly,
    leads,
    myPipelineOnly,
    noValueOnly,
    openOpportunitiesOnly,
    requireEmail,
    requirePhone,
    salesperson.email,
    salesperson.id,
    salesFilter,
    search,
    stageFilters,
    stageLabels,
    unassignedOnly,
  ]);

  const activeSearchChips = useMemo<SearchChip[]>(() => {
    const chips: SearchChip[] = [];

    if (groupByField !== "stage") {
      chips.push({ id: "group_by", label: GROUP_BY_LABELS[groupByField] });
    }

    if (salesFilter !== "all") {
      chips.push({ id: `sales:${salesFilter}`, label: SALES_FILTER_LABELS[salesFilter] });
    }

    if (myPipelineOnly && salesFilter !== "my_pipeline") {
      chips.push({ id: "my_pipeline", label: "My Pipeline" });
    }
    if (unassignedOnly) chips.push({ id: "unassigned", label: "Unassigned" });
    if (openOpportunitiesOnly) chips.push({ id: "open_opportunities", label: "Open Opportunities" });
    if (customIncludeArchived) chips.push({ id: "include_archived", label: "Include archived" });

    stageFilters.forEach((stageKey) => {
      chips.push({ id: `stage:${stageKey}`, label: stageLabels[stageKey] || stageKey });
    });

    customFilterRules.filter(isCustomFilterRuleComplete).forEach((rule) => {
      const fieldLabel = CUSTOM_FILTER_FIELDS.find((item) => item.value === rule.field)?.label || rule.field;
      const valueLabel = rule.value.trim();
      chips.push({
        id: `custom:${rule.id}`,
        label: valueLabel ? `${fieldLabel}: ${valueLabel}` : fieldLabel,
      });
    });

    if (requireEmail) chips.push({ id: "has_email", label: "Has email" });
    if (requirePhone) chips.push({ id: "has_phone", label: "Has phone" });
    if (highProbabilityOnly) chips.push({ id: "high_probability", label: "High probability" });
    if (noValueOnly) chips.push({ id: "no_value", label: "No expected value" });

    return chips;
  }, [
    customFilterRules,
    customIncludeArchived,
    groupByField,
    highProbabilityOnly,
    myPipelineOnly,
    noValueOnly,
    openOpportunitiesOnly,
    requireEmail,
    requirePhone,
    salesFilter,
    stageFilters,
    stageLabels,
    unassignedOnly,
  ]);

  const getGroupValue = useCallback(
    (lead: CrmLeadItem) => {
      if (groupByField === "salesperson") {
        return (lead.createdByName || lead.createdByEmail || "Unassigned").trim();
      }
      if (groupByField === "sales_team") {
        return (lead.createdByRole || "Unassigned").trim();
      }
      if (groupByField === "stage") return stageLabels[lead.stage] || lead.stage || "";
      if (groupByField === "city") return getLeadLocationValue(lead, "city");
      if (groupByField === "country") return getLeadLocationValue(lead, "country");
      if (groupByField === "lost_reason") return readPipelineTagValue(lead.tags, "lost");
      if (groupByField === "campaign") return readPipelineTagValue(lead.tags, "campaign");
      if (groupByField === "medium") return readPipelineTagValue(lead.tags, "medium");
      return readPipelineTagValue(lead.tags, "source");
    },
    [getLeadLocationValue, groupByField, stageLabels]
  );

  const orderedLeads = useMemo(() => {
    const dateValue = (lead: CrmLeadItem) => {
      if (groupByDate === "expected_closing") {
        return new Date(lead.expectedClosingDate || lead.createdAt).getTime();
      }
      if (groupByDate === "closed_date") return new Date(lead.updatedAt).getTime();
      return new Date(lead.createdAt).getTime();
    };

    return [...filteredLeads].sort((a, b) => {
      const groupCompare = getGroupValue(a).localeCompare(getGroupValue(b));
      if (groupCompare !== 0) return groupCompare;

      if (sortMode === "recent") return dateValue(b) - dateValue(a);
      if (sortMode === "oldest") return dateValue(a) - dateValue(b);
      if (sortMode === "value_desc") return (b.value ?? 0) - (a.value ?? 0);
      if (sortMode === "value_asc") return (a.value ?? 0) - (b.value ?? 0);
      return (a.clientName || a.title || "").localeCompare(b.clientName || b.title || "");
    });
  }, [filteredLeads, getGroupValue, groupByDate, sortMode]);

  const grouped = useMemo(() => {
    return stagesForBoard.map((stage) => {
      const items = orderedLeads.filter((lead) => lead.stage === stage.key);
      return {
        ...stage,
        items,
        expectedRevenueTotal: items.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
      };
    });
  }, [orderedLeads, stagesForBoard]);

  const groupedBySelectedField = useMemo<GroupedPipelineStage[]>(() => {
    if (groupByField === "stage") {
      return grouped.map((stage) => ({
        key: stage.key,
        label: stage.label,
        items: stage.items,
        expectedRevenueTotal: stage.expectedRevenueTotal,
      }));
    }

    const groups = new Map<string, CrmLeadItem[]>();
    orderedLeads.forEach((lead) => {
      const rawLabel = getGroupValue(lead).trim();
      const label = rawLabel.length > 0 ? rawLabel : "Undefined";
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)?.push(lead);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, items]) => ({
        key: `${groupByField}:${label.toLowerCase()}`,
        label:
          label === "Undefined"
            ? groupByField === "city"
              ? "No City"
              : groupByField === "country"
                ? "No Country"
                : label
            : label,
        items,
        expectedRevenueTotal: items.reduce((sum, lead) => sum + (lead.value ?? 0), 0),
      }));
  }, [getGroupValue, groupByField, grouped, orderedLeads]);

  const stageThemeByKey = useMemo(() => {
    return visibleStageKeys.reduce<Record<string, (typeof STAGE_THEMES)[number]>>((acc, key, index) => {
      acc[key] = STAGE_THEMES[index % STAGE_THEMES.length];
      return acc;
    }, {});
  }, [visibleStageKeys]);

  return {
    activeSearchChips,
    filteredLeads,
    groupedBySelectedField,
    isStageGrouping: groupByField === "stage",
    orderedLeads,
    stageThemeByKey,
    visibleStages,
  };
}
