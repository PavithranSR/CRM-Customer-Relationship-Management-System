"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Filter, Layers3, Star } from "lucide-react";

const DATE_RANGE_OPTIONS = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "this_year", label: "This Year" },
  { value: "older", label: "Older" },
] as const;

const BUDGET_RANGE_OPTIONS = [
  { value: "lte_5000", label: "Budget <= 5,000" },
  { value: "range_5001_20000", label: "Budget 5,001 - 20,000" },
  { value: "gte_20001", label: "Budget >= 20,001" },
] as const;

function parseList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface QuotationsFilterDropdownProps {
  filterPreset: string;
  documentType: string;
  dateField: string;
  groupBy: string;
  activeTab: string;
  activeView: string;
  deletedView: boolean;
  query: string;
  customFilter: string;
  projectPreset: string;
  projectCategory: string;
  projectBudgetRanges: string;
  budgetMin: string;
  budgetMax: string;
  quotationStatus: string;
  salespersonFilter: string;
  customerFilter: string;
  paymentMethodFilter: string;
  quotationDateRange: string;
  projectStatus: string;
  projectDateRange: string;
  projectCategories: string[];
  quotationStatusOptions: string[];
  salespersonOptions: string[];
  customerOptions: string[];
  paymentMethodOptions: string[];
  projectStatusOptions: string[];
  saveSearchHref: string;
  clearAllHref: string;
  groupByLinks: Array<{ key: string; label: string; href: string }>;
}

type ExpandableSectionKey =
  | "projectCategory"
  | "projectStatus"
  | "projectBudget"
  | "projectDate"
  | "quotationStatus"
  | "quotationSalesperson"
  | "quotationCustomer"
  | "quotationPayment"
  | "quotationDate";

export function QuotationsFilterDropdown(props: QuotationsFilterDropdownProps) {
  const {
    filterPreset,
    documentType,
    dateField,
    groupBy,
    activeTab,
    activeView,
    deletedView,
    query,
    customFilter,
    projectPreset,
    projectCategory,
    projectBudgetRanges,
    budgetMin,
    budgetMax,
    quotationStatus,
    salespersonFilter,
    customerFilter,
    paymentMethodFilter,
    quotationDateRange,
    projectStatus,
    projectDateRange,
    projectCategories,
    quotationStatusOptions,
    salespersonOptions,
    customerOptions,
    paymentMethodOptions,
    projectStatusOptions,
    saveSearchHref,
    clearAllHref,
    groupByLinks,
  } = props;

  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [stagedFilterPreset, setStagedFilterPreset] = useState(filterPreset);
  const [stagedDocumentType, setStagedDocumentType] = useState(documentType);
  const [stagedDateField, setStagedDateField] = useState(dateField);
  const [stagedGroupBy, setStagedGroupBy] = useState(groupBy);
  const [stagedCustomFilter, setStagedCustomFilter] = useState(customFilter);
  const [stagedProjectPreset, setStagedProjectPreset] = useState(projectPreset);
  const [stagedProjectCategories, setStagedProjectCategories] = useState<string[]>(parseList(projectCategory));
  const [stagedProjectBudgetRanges, setStagedProjectBudgetRanges] = useState<string[]>(parseList(projectBudgetRanges));
  const [stagedBudgetMin, setStagedBudgetMin] = useState(budgetMin);
  const [stagedBudgetMax, setStagedBudgetMax] = useState(budgetMax);
  const [stagedQuotationStatuses, setStagedQuotationStatuses] = useState<string[]>(parseList(quotationStatus));
  const [stagedSalespeople, setStagedSalespeople] = useState<string[]>(parseList(salespersonFilter));
  const [stagedCustomers, setStagedCustomers] = useState<string[]>(parseList(customerFilter));
  const [stagedPaymentMethods, setStagedPaymentMethods] = useState<string[]>(parseList(paymentMethodFilter));
  const [stagedQuotationDateRange, setStagedQuotationDateRange] = useState(quotationDateRange);
  const [stagedProjectStatuses, setStagedProjectStatuses] = useState<string[]>(parseList(projectStatus));
  const [stagedProjectDateRange, setStagedProjectDateRange] = useState(projectDateRange);
  const [expandedSections, setExpandedSections] = useState<Record<ExpandableSectionKey, boolean>>({
    projectCategory: activeTab === "projects",
    projectStatus: parseList(projectStatus).length > 0,
    projectBudget: parseList(projectBudgetRanges).length > 0 || Boolean(budgetMin) || Boolean(budgetMax),
    projectDate: Boolean(projectDateRange),
    quotationStatus: activeTab !== "projects",
    quotationSalesperson: parseList(salespersonFilter).length > 0,
    quotationCustomer: parseList(customerFilter).length > 0,
    quotationPayment: parseList(paymentMethodFilter).length > 0,
    quotationDate: Boolean(quotationDateRange),
  });

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (target && containerRef.current && !containerRef.current.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  const syncStagedValues = () => {
    setStagedFilterPreset(filterPreset);
    setStagedDocumentType(documentType);
    setStagedDateField(dateField);
    setStagedGroupBy(groupBy);
    setStagedCustomFilter(customFilter);
    setStagedProjectPreset(projectPreset);
    setStagedProjectCategories(parseList(projectCategory));
    setStagedProjectBudgetRanges(parseList(projectBudgetRanges));
    setStagedBudgetMin(budgetMin);
    setStagedBudgetMax(budgetMax);
    setStagedQuotationStatuses(parseList(quotationStatus));
    setStagedSalespeople(parseList(salespersonFilter));
    setStagedCustomers(parseList(customerFilter));
    setStagedPaymentMethods(parseList(paymentMethodFilter));
    setStagedQuotationDateRange(quotationDateRange);
    setStagedProjectStatuses(parseList(projectStatus));
    setStagedProjectDateRange(projectDateRange);
    setExpandedSections({
      projectCategory: activeTab === "projects",
      projectStatus: parseList(projectStatus).length > 0,
      projectBudget: parseList(projectBudgetRanges).length > 0 || Boolean(budgetMin) || Boolean(budgetMax),
      projectDate: Boolean(projectDateRange),
      quotationStatus: activeTab !== "projects",
      quotationSalesperson: parseList(salespersonFilter).length > 0,
      quotationCustomer: parseList(customerFilter).length > 0,
      quotationPayment: parseList(paymentMethodFilter).length > 0,
      quotationDate: Boolean(quotationDateRange),
    });
  };

  const buttonClass = (active: boolean) =>
    `block w-full rounded px-2 py-1 text-left text-base hover:bg-slate-200 ${active ? "bg-slate-200 font-semibold" : ""}`;

  const toggleSection = (section: ExpandableSectionKey) => {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const applyQuotationFilters = (overrides?: {
    tab?: string;
    filterPreset?: string;
    documentType?: string;
    dateField?: string;
    groupBy?: string;
    customFilter?: string;
    quotationStatuses?: string[];
    salespeople?: string[];
    customers?: string[];
    paymentMethods?: string[];
    quotationDateRange?: string;
  }) => {
    const next = new URLSearchParams();
    const nextTab = overrides?.tab ?? activeTab;
    const nextFilterPreset = overrides?.filterPreset ?? stagedFilterPreset;
    const nextDocumentType = overrides?.documentType ?? stagedDocumentType;
    const nextDateField = overrides?.dateField ?? stagedDateField;
    const nextGroupBy = overrides?.groupBy ?? stagedGroupBy;
    const nextCustomFilter = (overrides?.customFilter ?? stagedCustomFilter).trim();
    const nextQuotationStatuses = overrides?.quotationStatuses ?? stagedQuotationStatuses;
    const nextSalespeople = overrides?.salespeople ?? stagedSalespeople;
    const nextCustomers = overrides?.customers ?? stagedCustomers;
    const nextPaymentMethods = overrides?.paymentMethods ?? stagedPaymentMethods;
    const nextQuotationDateRange = (overrides?.quotationDateRange ?? stagedQuotationDateRange).trim();

    if (nextTab && nextTab !== "quotations") next.set("tab", nextTab);
    if (activeView && activeView !== "list") next.set("view", activeView);
    if (query.trim()) next.set("q", query.trim());
    if (nextFilterPreset && nextFilterPreset !== "my_quotations") next.set("filterPreset", nextFilterPreset);
    if (nextDocumentType && nextDocumentType !== "quotations") next.set("documentType", nextDocumentType);
    if (nextDateField && nextDateField !== "create_date") next.set("dateField", nextDateField);
    if (nextGroupBy) next.set("groupBy", nextGroupBy);
    if (nextCustomFilter) next.set("customFilter", nextCustomFilter);
    if (nextQuotationStatuses.length > 0) next.set("quotationStatus", nextQuotationStatuses.join(","));
    if (nextSalespeople.length > 0) next.set("salespersonFilter", nextSalespeople.join(","));
    if (nextCustomers.length > 0) next.set("customerFilter", nextCustomers.join(","));
    if (nextPaymentMethods.length > 0) next.set("paymentMethodFilter", nextPaymentMethods.join(","));
    if (nextQuotationDateRange) next.set("quotationDateRange", nextQuotationDateRange);
    if (deletedView) next.set("deleted", "1");

    const queryString = next.toString();
    router.push(queryString ? `/crm/quotations?${queryString}` : "/crm/quotations");
    setOpen(false);
  };

  const applyProjectFilters = (overrides?: {
    projectPreset?: string;
    projectCategories?: string[];
    projectBudgetRanges?: string[];
    budgetMin?: string;
    budgetMax?: string;
    groupBy?: string;
    customFilter?: string;
    query?: string;
    projectStatuses?: string[];
    projectDateRange?: string;
    closePanel?: boolean;
  }) => {
    const next = new URLSearchParams({ tab: "projects" });
    const nextPreset = overrides?.projectPreset ?? stagedProjectPreset;
    const nextCategories = overrides?.projectCategories ?? stagedProjectCategories;
    const nextBudgetRanges = overrides?.projectBudgetRanges ?? stagedProjectBudgetRanges;
    const nextBudgetMin = (overrides?.budgetMin ?? stagedBudgetMin).trim();
    const nextBudgetMax = (overrides?.budgetMax ?? stagedBudgetMax).trim();
    const nextGroupBy = overrides?.groupBy ?? stagedGroupBy;
    const nextCustomFilter = (overrides?.customFilter ?? stagedCustomFilter).trim();
    const nextQuery = (overrides?.query ?? query).trim();
    const nextProjectStatuses = overrides?.projectStatuses ?? stagedProjectStatuses;
    const nextProjectDateRange = (overrides?.projectDateRange ?? stagedProjectDateRange).trim();
    const shouldClose = overrides?.closePanel ?? true;

    if (activeView && activeView !== "list") next.set("view", activeView);
    if (nextPreset) next.set("projectPreset", nextPreset);
    if (nextCategories.length > 0) next.set("projectCategory", nextCategories.join(","));
    if (nextBudgetRanges.length > 0) next.set("projectBudgetRanges", nextBudgetRanges.join(","));
    if (nextBudgetMin) next.set("budgetMin", nextBudgetMin);
    if (nextBudgetMax) next.set("budgetMax", nextBudgetMax);
    if (nextProjectStatuses.length > 0) next.set("projectStatus", nextProjectStatuses.join(","));
    if (nextProjectDateRange) next.set("projectDateRange", nextProjectDateRange);
    if (nextGroupBy) next.set("groupBy", nextGroupBy);
    if (nextCustomFilter) next.set("customFilter", nextCustomFilter);
    if (nextQuery) next.set("q", nextQuery);

    router.push(`/crm/quotations?${next.toString()}`);
    if (shouldClose) setOpen(false);
  };

  const renderButtons = (
    section: ExpandableSectionKey,
    heading: string,
    options: Array<{ value: string; label: string }>,
    activeValues: string[],
    onToggle: (value: string) => void,
  ) => (
    <div className="space-y-1 border-t border-slate-300 pt-2">
      <button
        type="button"
        onClick={() => toggleSection(section)}
        className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expandedSections[section] ? "rotate-180" : ""}`} />
      </button>
      {expandedSections[section]
        ? options.map((option) => (
            <button key={option.value} type="button" onClick={() => onToggle(option.value)} className={buttonClass(activeValues.includes(option.value))}>
              {option.label}
            </button>
          ))
        : null}
    </div>
  );

  const panelClass = "grid gap-3 md:grid-cols-3";
  const columnClass = "space-y-3";
  const listClass = "max-h-[22rem] space-y-1 overflow-y-auto pr-1";

  return (
    <div ref={containerRef} className="relative flex min-h-11 shrink-0 self-stretch border-l border-slate-300">
      <button
        type="button"
        className="flex min-h-11 w-[54px] flex-1 items-center justify-center self-stretch bg-white text-slate-700 transition hover:bg-slate-50"
        aria-label="Open filters"
        onClick={() => {
          if (!open) syncStagedValues();
          setOpen((current) => !current);
        }}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="fixed inset-x-2 top-24 z-40 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg border border-slate-300 bg-slate-50 p-3 shadow-lg md:left-1/2 md:right-auto md:top-36 md:w-[960px] md:max-w-[96vw] md:-translate-x-1/2">
          {activeTab === "projects" ? (
            <form
              method="get"
              action="/crm/quotations"
              className={panelClass}
              onSubmit={(event) => {
                event.preventDefault();
                applyProjectFilters();
              }}
            >
              <div className={`${columnClass} md:border-r md:border-slate-300 md:pr-3`}>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#7c5a77]" />
                  <p className="text-base font-semibold">Filters</p>
                </div>
                <div className={listClass}>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedProjectPreset("all_projects");
                      setStagedProjectCategories([]);
                      setStagedProjectBudgetRanges([]);
                      setStagedBudgetMin("");
                      setStagedBudgetMax("");
                      setStagedProjectStatuses([]);
                      setStagedProjectDateRange("");
                      applyProjectFilters({
                        projectPreset: "all_projects",
                        projectCategories: [],
                        projectBudgetRanges: [],
                        budgetMin: "",
                        budgetMax: "",
                        projectStatuses: [],
                        projectDateRange: "",
                        closePanel: false,
                      });
                    }}
                    className={buttonClass(
                      stagedProjectPreset === "all_projects" &&
                        stagedProjectCategories.length === 0 &&
                        stagedProjectBudgetRanges.length === 0 &&
                        stagedProjectStatuses.length === 0 &&
                        !stagedBudgetMin &&
                        !stagedBudgetMax &&
                        !stagedProjectDateRange
                    )}
                  >
                    All Projects
                  </button>

                  {projectCategories.length > 0
                    ? renderButtons(
                        "projectCategory",
                        "Category",
                        projectCategories.map((category) => ({ value: category, label: category })),
                        stagedProjectCategories,
                        (value) => {
                          const nextCategories = toggleValue(stagedProjectCategories, value);
                          setStagedProjectPreset("");
                          setStagedProjectCategories(nextCategories);
                          applyProjectFilters({
                            projectPreset: "",
                            projectCategories: nextCategories,
                            closePanel: false,
                          });
                        }
                      )
                    : null}

                  {projectStatusOptions.length > 0
                    ? renderButtons(
                        "projectStatus",
                        "Status",
                        projectStatusOptions.map((status) => ({ value: status, label: formatLabel(status) })),
                        stagedProjectStatuses,
                        (value) => {
                          const nextStatuses = toggleValue(stagedProjectStatuses, value);
                          setStagedProjectPreset("");
                          setStagedProjectStatuses(nextStatuses);
                          applyProjectFilters({
                            projectPreset: "",
                            projectStatuses: nextStatuses,
                            closePanel: false,
                          });
                        }
                      )
                    : null}

                  {renderButtons("projectBudget", "Budget", [...BUDGET_RANGE_OPTIONS], stagedProjectBudgetRanges, (value) => {
                    const nextRanges = toggleValue(stagedProjectBudgetRanges, value);
                    setStagedProjectPreset("");
                    setStagedProjectBudgetRanges(nextRanges);
                    applyProjectFilters({
                      projectPreset: "",
                      projectBudgetRanges: nextRanges,
                      closePanel: false,
                    });
                  })}

                  {expandedSections.projectBudget ? (
                    <div className="grid grid-cols-2 gap-2 px-2 pt-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stagedBudgetMin}
                        onChange={(event) => setStagedBudgetMin(event.target.value)}
                        placeholder="Min"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={stagedBudgetMax}
                        onChange={(event) => setStagedBudgetMax(event.target.value)}
                        placeholder="Max"
                        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-slate-500"
                      />
                    </div>
                  ) : null}

                  {renderButtons("projectDate", "Date", [...DATE_RANGE_OPTIONS], stagedProjectDateRange ? [stagedProjectDateRange] : [], (value) => {
                    const nextValue = stagedProjectDateRange === value ? "" : value;
                    setStagedProjectPreset("");
                    setStagedProjectDateRange(nextValue);
                    applyProjectFilters({
                      projectPreset: "",
                      projectDateRange: nextValue,
                      closePanel: false,
                    });
                  })}

                  <div className="space-y-2 border-t border-slate-300 pt-2">
                    <input
                      type="text"
                      name="customFilter"
                      value={stagedCustomFilter}
                      onChange={(event) => {
                        setStagedProjectPreset("");
                        setStagedCustomFilter(event.target.value);
                      }}
                      placeholder="Custom Filter..."
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base outline-none focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </div>

              <div className={`${columnClass} border-t border-slate-300 pt-3 md:border-r md:border-t-0 md:border-slate-300 md:px-3 md:pt-0`}>
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-teal-700" />
                  <p className="text-base font-semibold">Group By</p>
                </div>
                <div className={listClass}>
                  {[
                    { key: "project_name", label: "Project Name" },
                    { key: "category", label: "Category" },
                    { key: "status", label: "Status" },
                    { key: "budget", label: "Budget" },
                    { key: "create_date", label: "Create Date" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setStagedGroupBy(item.key);
                        setStagedProjectPreset("");
                        applyProjectFilters({ groupBy: item.key, projectPreset: "" });
                      }}
                      className={buttonClass(stagedGroupBy === item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${columnClass} border-t border-slate-300 pt-3 md:border-t-0 md:pl-3 md:pt-0`}>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <p className="text-base font-semibold">Favorites</p>
                </div>
                <div className={listClass}>
                  <button
                    type="button"
                    onClick={() => applyProjectFilters()}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                  >
                    <span>Save current search</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <div className="border-t border-slate-300 pt-2">
                    <Link href={clearAllHref} onClick={() => setOpen(false)} className="block rounded px-2 py-1 text-left text-base hover:bg-slate-200">
                      Clear all search options
                    </Link>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <form
              method="get"
              action="/crm/quotations"
              className={panelClass}
              onSubmit={(event) => {
                event.preventDefault();
                applyQuotationFilters();
              }}
            >
              <div className={`${columnClass} md:border-r md:border-slate-300 md:pr-3`}>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-[#7c5a77]" />
                  <p className="text-base font-semibold">Filters</p>
                </div>
                <div className={listClass}>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFilterPreset("my_quotations");
                      setStagedDocumentType("quotations");
                      applyQuotationFilters({
                        tab: "quotations",
                        filterPreset: "my_quotations",
                        documentType: "quotations",
                      });
                    }}
                    className={buttonClass(stagedFilterPreset === "my_quotations")}
                  >
                    My Quotations
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFilterPreset("all_quotations");
                      setStagedDocumentType("quotations");
                      applyQuotationFilters({
                        tab: "quotations",
                        filterPreset: "all_quotations",
                        documentType: "quotations",
                      });
                    }}
                    className={buttonClass(
                      stagedDocumentType === "quotations" &&
                        (stagedFilterPreset === "all_quotations" || !stagedFilterPreset)
                    )}
                  >
                    Quotations
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFilterPreset("unconfirmed_quotations");
                      setStagedDocumentType("quotations");
                      applyQuotationFilters({
                        tab: "quotations",
                        filterPreset: "unconfirmed_quotations",
                        documentType: "quotations",
                      });
                    }}
                    className={buttonClass(stagedFilterPreset === "unconfirmed_quotations")}
                  >
                    Unconfirmed Quotations
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStagedFilterPreset("all_quotations");
                      setStagedDocumentType("sales_orders");
                      applyQuotationFilters({
                        tab: "orders",
                        filterPreset: "all_quotations",
                        documentType: "sales_orders",
                      });
                    }}
                    className={buttonClass(stagedDocumentType === "sales_orders")}
                  >
                    Sales Orders
                  </button>

                  {quotationStatusOptions.length > 0
                    ? renderButtons(
                        "quotationStatus",
                        "Status",
                        quotationStatusOptions.map((status) => ({ value: status, label: formatLabel(status) })),
                        stagedQuotationStatuses,
                        (value) => {
                          const nextStatuses = toggleValue(stagedQuotationStatuses, value);
                          setStagedQuotationStatuses(nextStatuses);
                          applyQuotationFilters({ quotationStatuses: nextStatuses });
                        }
                      )
                    : null}

                  {salespersonOptions.length > 0
                    ? renderButtons(
                        "quotationSalesperson",
                        "Salesperson",
                        salespersonOptions.map((salesperson) => ({ value: salesperson, label: salesperson })),
                        stagedSalespeople,
                        (value) => {
                          const nextSalespeople = toggleValue(stagedSalespeople, value);
                          setStagedSalespeople(nextSalespeople);
                          applyQuotationFilters({ salespeople: nextSalespeople });
                        }
                      )
                    : null}

                  {customerOptions.length > 0
                    ? renderButtons(
                        "quotationCustomer",
                        "Customer",
                        customerOptions.map((customer) => ({ value: customer, label: customer })),
                        stagedCustomers,
                        (value) => {
                          const nextCustomers = toggleValue(stagedCustomers, value);
                          setStagedCustomers(nextCustomers);
                          applyQuotationFilters({ customers: nextCustomers });
                        }
                      )
                    : null}

                  {paymentMethodOptions.length > 0
                    ? renderButtons(
                        "quotationPayment",
                        "Payment Method",
                        paymentMethodOptions.map((method) => ({ value: method, label: method })),
                        stagedPaymentMethods,
                        (value) => {
                          const nextMethods = toggleValue(stagedPaymentMethods, value);
                          setStagedPaymentMethods(nextMethods);
                          applyQuotationFilters({ paymentMethods: nextMethods });
                        }
                      )
                    : null}

                  <div className="space-y-1 border-t border-slate-300 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleSection("quotationDate")}
                      className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                      <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${expandedSections.quotationDate ? "rotate-180" : ""}`} />
                    </button>
                    {expandedSections.quotationDate ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setStagedDateField("create_date");
                            applyQuotationFilters({ dateField: "create_date" });
                          }}
                          className={buttonClass(stagedDateField === "create_date")}
                        >
                          Create Date
                        </button>
                        {DATE_RANGE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              const nextValue = stagedQuotationDateRange === option.value ? "" : option.value;
                              setStagedQuotationDateRange(nextValue);
                              applyQuotationFilters({ quotationDateRange: nextValue });
                            }}
                            className={buttonClass(stagedQuotationDateRange === option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-2 border-t border-slate-300 pt-2">
                    <input
                      type="text"
                      name="customFilter"
                      value={stagedCustomFilter}
                      onChange={(event) => setStagedCustomFilter(event.target.value)}
                      placeholder="Custom Filter..."
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base outline-none focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-base font-semibold text-slate-800 hover:bg-slate-100"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </div>

              <div className={`${columnClass} border-t border-slate-300 pt-3 md:border-r md:border-t-0 md:border-slate-300 md:px-3 md:pt-0`}>
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-teal-700" />
                  <p className="text-base font-semibold">Group By</p>
                </div>
                <div className={listClass}>
                  {groupByLinks.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setStagedGroupBy(item.key);
                        applyQuotationFilters({ groupBy: item.key });
                      }}
                      className={buttonClass(stagedGroupBy === item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`${columnClass} border-t border-slate-300 pt-3 md:border-t-0 md:pl-3 md:pt-0`}>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <p className="text-base font-semibold">Favorites</p>
                </div>
                <div className={listClass}>
                  <Link
                    href={saveSearchHref}
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-base hover:bg-slate-200"
                  >
                    <span>Save current search</span>
                    <ChevronDown className="h-4 w-4" />
                  </Link>
                  <div className="border-t border-slate-300 pt-2">
                    <Link href={clearAllHref} onClick={() => setOpen(false)} className="block rounded px-2 py-1 text-left text-base hover:bg-slate-200">
                      Clear all search options
                    </Link>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
