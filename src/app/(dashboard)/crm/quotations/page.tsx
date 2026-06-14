import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth, canAccessAction } from "@/lib/auth";
import { getAllCrmQuotations, getDeletedCrmQuotations } from "@/actions/quotation.actions";
import { getCrmProjectTypes } from "@/actions/crm-project-types.actions";
import { db } from "@/lib/db";
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  BarChart3,
  CircleDollarSign,
  FileText,
  Send,
  Trophy,
} from "lucide-react";
import { QuotationsFilterDropdown } from "@/components/crm/quotations-filter-dropdown";
import { CrmProjectTypesManager } from "@/components/crm/crm-project-types-manager";
import { CrmToolbarSearch } from "@/components/crm/crm-toolbar-search";
import { OrdersAwaitingInvoiceTable } from "@/components/crm/orders-awaiting-invoice-table";
import { OrdersToInvoiceTable } from "@/components/crm/orders-to-invoice-table";
import { OrdersToInvoiceSettings } from "@/components/crm/orders-to-invoice-settings";
import { OrdersToInvoiceSelectionToolbar } from "@/components/crm/orders-to-invoice-selection-toolbar";
import { OrdersToUpsellTable } from "@/components/crm/orders-to-upsell-table";
import { CrmProjectsImportExportMenu } from "@/components/crm/crm-projects-import-export-menu";
import { QuotationsOrdersListTable } from "@/components/crm/quotations-orders-list-table";
import { SalesSummaryListTable } from "@/components/crm/sales-summary-list-table";
import { SalesViewSwitcher, type SalesViewKey } from "@/components/crm/sales-view-switcher";
import { withInternalBackHref } from "@/lib/internal-navigation";
import { getModuleReportingHref } from "@/lib/module-navigation";
import {
  QUOTATION_DELETE_BLOCKED_COUNT_PARAM,
  QUOTATION_DELETE_BLOCKED_REF_PARAM,
  QUOTATION_DELETE_NOTICE_PARAM,
  isInvoiceFirstDeleteNotice,
} from "@/lib/quotation-delete-notice";

interface CrmQuotationsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    tab?: string;
    view?: string;
    filterPreset?: string;
    documentType?: string;
    embedded?: string;
    leadId?: string;
    leadName?: string;
    dateField?: string;
    customFilter?: string;
    groupBy?: string;
    projectPreset?: string;
    projectCategory?: string;
    projectBudgetRanges?: string;
    budgetMin?: string;
    budgetMax?: string;
    quotationStatus?: string;
    salespersonFilter?: string;
    customerFilter?: string;
    paymentMethodFilter?: string;
    quotationDateRange?: string;
    projectStatus?: string;
    projectDateRange?: string;
    newProject?: string;
    deleted?: string;
    deleteNotice?: string;
    blockedCount?: string;
    blockedRef?: string;
  }>;
}

const SALES_PAGE_HEIGHT_CLASS =
  "h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6rem)] md:h-[calc(100dvh-6.5rem)]";
const SALES_PAGE_BOTTOM_OFFSET_CLASS = "-mb-4 sm:-mb-5";

function getPreferredProductName(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = (value || "").trim();
    if (trimmed) return trimmed;
  }
  return "Service";
}

function buildMailtoHref(email: string | null | undefined, subject: string, body: string) {
  const normalizedEmail = (email || "").trim();
  if (!normalizedEmail) return null;

  const params = new URLSearchParams({
    subject,
    body,
  });
  return `mailto:${normalizedEmail}?${params.toString()}`;
}

function buildPreferredContactHref({
  email,
  phone,
  subject,
  body,
}: {
  email?: string | null;
  phone?: string | null;
  subject: string;
  body: string;
}) {
  const mailtoHref = buildMailtoHref(email, subject, body);
  if (mailtoHref) return mailtoHref;

  const normalizedPhone = (phone || "").trim();
  if (!normalizedPhone) return null;
  return `tel:${normalizedPhone.replace(/\s+/g, "")}`;
}

function parseCommaSeparatedValues(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatFilterLabel(value: string) {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateRangeLabel(value: string) {
  if (value === "last_7_days") return "Last 7 Days";
  if (value === "last_30_days") return "Last 30 Days";
  if (value === "this_month") return "This Month";
  if (value === "this_year") return "This Year";
  if (value === "older") return "Older";
  return formatFilterLabel(value);
}

function matchesRelativeDateRange(value: Date | string | null | undefined, range: string) {
  if (!range) {
    return true;
  }

  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  const sevenDaysAgo = new Date(todayStart);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  if (range === "last_7_days") {
    return date >= sevenDaysAgo;
  }

  if (range === "last_30_days") {
    return date >= thirtyDaysAgo;
  }

  if (range === "this_month") {
    return date >= thisMonthStart;
  }

  if (range === "this_year") {
    return date >= thisYearStart;
  }

  if (range === "older") {
    return date < thirtyDaysAgo;
  }

  return true;
}

function getSuggestedUpgradeProduct(productName: string) {
  const normalized = productName.trim().toLowerCase();
  if (!normalized) return "Premium Service Package";
  if (normalized.includes("basic")) return `${productName.replace(/basic/i, "Premium")} Upgrade`;
  if (normalized.includes("standard")) return `${productName.replace(/standard/i, "Professional")} Upgrade`;
  if (normalized.includes("premium")) return `${productName} Enterprise Extension`;
  if (normalized.includes("hardware")) return `${productName} Support Plus`;
  if (normalized.includes("service")) return `${productName} Plus`;
  return `${productName} Premium Package`;
}

function getUpsellOpportunityStatus(createdAt: Date, totalAmount: number) {
  const orderTime = new Date(createdAt).getTime();
  const ageInDays = Number.isFinite(orderTime)
    ? Math.floor((Date.now() - orderTime) / (1000 * 60 * 60 * 24))
    : 999;

  if (totalAmount >= 100000) return "Priority Upsell";
  if (ageInDays <= 30) return "Ready to Contact";
  if (ageInDays <= 90) return "Follow Up";
  return "Nurture";
}

export default async function CrmQuotationsPage({ searchParams }: CrmQuotationsPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const leadFilterId = (params.leadId || "").trim();
  const leadFilterLabel = (params.leadName || "").trim();
  type QuotationsList = Awaited<ReturnType<typeof getAllCrmQuotations>>;
  type DeletedQuotationsList = Awaited<ReturnType<typeof getDeletedCrmQuotations>>;
  type ProjectTypesList = Awaited<ReturnType<typeof getCrmProjectTypes>>;
  type ProjectListRow = {
    id: string;
    name: string;
    category: string | null;
    price: number;
    gstPercent: number;
    status: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type InvoiceRow = {
    invoiceId: string;
    quotationId: string;
    crmLeadId: string;
    invoiceRef: string;
    orderNo: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string | null;
    productName: string;
    projectTitle: string;
    salespersonName: string | null;
    paymentType: string | null;
    balanceAmount: number;
    status: string;
    totalAmount: number;
    createdAt: Date;
  };

  let dbErrorMessage: string | null = null;
  let quotations: QuotationsList = [];
  let deletedQuotations: DeletedQuotationsList = [];
  let projectTypes: ProjectTypesList = [];
  let projectRows: ProjectListRow[] = [];
  let invoiceRows: InvoiceRow[] = [];

  try {
    quotations = await getAllCrmQuotations();
  } catch {
    dbErrorMessage = "Database is currently unreachable. Showing cached/empty results.";
  }

  try {
    deletedQuotations = await getDeletedCrmQuotations();
  } catch {
    dbErrorMessage = dbErrorMessage || "Database is currently unreachable. Showing cached/empty results.";
  }

  try {
    projectTypes = await getCrmProjectTypes();
  } catch {
    dbErrorMessage = dbErrorMessage || "Database is currently unreachable. Showing cached/empty results.";
  }
  try {
    projectRows = await db.$queryRaw<ProjectListRow[]>`
      SELECT
        "id",
        "name",
        "category",
        "price",
        "gstPercent",
        "status",
        "description",
        "createdAt",
        "updatedAt"
      FROM "crm_projects"
      ORDER BY "createdAt" DESC
    `;
  } catch {
    // ignore; project type list can still be used
  }
  const documentType = (params.documentType || "quotations").toLowerCase();
  const rawTab = (params.tab || "").toLowerCase();
  const normalizedTab = rawTab === "products" ? "projects" : rawTab;
  const activeTab = normalizedTab || (documentType === "sales_orders" ? "orders" : "quotations");
  const deletedView = params.deleted === "1";
  const orderTabs = ["quotations", "orders", "sales-teams", "customers"] as const;
  const isOrderTab = (orderTabs as readonly string[]).includes(activeTab);
  const selectedOrderTab = (orderTabs as readonly string[]).includes(activeTab) ? activeTab : "quotations";
  const selectedOrderLabel =
    selectedOrderTab === "quotations"
      ? "Quotations"
      : selectedOrderTab === "sales-teams"
        ? "Sales Teams"
        : selectedOrderTab === "customers"
          ? "Customers"
          : "Orders";
  const salesDocumentLabel = selectedOrderTab === "orders" ? "Order" : "Quotation";
  const salesDocumentLabelLower = salesDocumentLabel.toLowerCase();
  const salesDocumentPluralLabel = selectedOrderTab === "orders" ? "Orders" : "Quotations";
  const salesDocumentPluralLabelLower = salesDocumentPluralLabel.toLowerCase();
  const salesDocumentNumberLabel = `${salesDocumentLabel} No`;
  const toInvoiceTabs = ["to-invoice", "orders-to-invoice", "orders-to-upsell"] as const;
  const selectedToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab) ? activeTab : "to-invoice";
  const isToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab);
  const isInvoiceListTab = isToInvoiceTab && selectedToInvoiceTab === "to-invoice";
  const isOrdersToInvoiceTab = isToInvoiceTab && selectedToInvoiceTab === "orders-to-invoice";
  const isUpsellTab = isToInvoiceTab && selectedToInvoiceTab === "orders-to-upsell";
  const isDeletedInvoiceView = isInvoiceListTab && deletedView;
  const isProjectsTab = activeTab === "projects";
  const isReportingTab = activeTab === "reporting";
  const isConfigurationTab = activeTab === "configuration";
  if (isReportingTab) {
    redirect(getModuleReportingHref("SALES"));
  }
  const isQuotationLikeTab =
    isOrderTab && !isToInvoiceTab && (selectedOrderTab === "orders" || selectedOrderTab === "quotations");
  const isDeletedQuotationView = isQuotationLikeTab && deletedView;
  const selectedToInvoiceLabel =
    selectedToInvoiceTab === "orders-to-invoice"
      ? "Orders to Invoice"
      : selectedToInvoiceTab === "orders-to-upsell"
        ? "Orders to Upsell"
        : "To Invoice";
  const tabLabelMap: Record<string, string> = {
    orders: "Orders",
    quotations: "Quotations",
    "sales-teams": "Sales Teams",
    customers: "Customers",
    "to-invoice": "To Invoice",
    "orders-to-invoice": "Orders to Invoice",
    "orders-to-upsell": "Orders to Upsell",
    projects: "Projects",
    reporting: "Reporting",
    configuration: "Configuration",
  };
  const activeView = (params.view || "list").toLowerCase();
  const allowedViews = new Set(["list", "kanban", "map", "calendar", "table", "chart", "history"]);
  const viewMode = allowedViews.has(activeView) ? activeView : "list";
  const filterPreset = (params.filterPreset || "my_quotations").toLowerCase();
  const dateField = (params.dateField || "create_date").toLowerCase();
  const groupBy = (params.groupBy || "").toLowerCase();
  const projectPreset = (params.projectPreset || "").toLowerCase();
  const query = (params.q || "").trim().toLowerCase();
  const customFilter = (params.customFilter || "").trim().toLowerCase();
  const projectCategory = (params.projectCategory || "").trim();
  const projectCategoryValues = parseCommaSeparatedValues(projectCategory);
  const projectBudgetRangeValues = parseCommaSeparatedValues(params.projectBudgetRanges);
  const quotationStatusValues = parseCommaSeparatedValues(params.quotationStatus).map((value) => value.toUpperCase());
  const salespersonFilterValues = parseCommaSeparatedValues(params.salespersonFilter);
  const customerFilterValues = parseCommaSeparatedValues(params.customerFilter);
  const paymentMethodFilterValues = parseCommaSeparatedValues(params.paymentMethodFilter);
  const quotationDateRange = (params.quotationDateRange || "").trim().toLowerCase();
  const projectStatusValues = parseCommaSeparatedValues(params.projectStatus);
  const projectDateRange = (params.projectDateRange || "").trim().toLowerCase();
  const rawBudgetMin = (params.budgetMin || "").trim();
  const rawBudgetMax = (params.budgetMax || "").trim();
  const budgetMin = rawBudgetMin === "" ? Number.NaN : Number(rawBudgetMin.replace(/,/g, ""));
  const budgetMax = rawBudgetMax === "" ? Number.NaN : Number(rawBudgetMax.replace(/,/g, ""));
  const deleteNotice = params[QUOTATION_DELETE_NOTICE_PARAM];
  const blockedDeleteRef = (params[QUOTATION_DELETE_BLOCKED_REF_PARAM] || "").trim();
  const blockedDeleteCountValue = Number.parseInt(params[QUOTATION_DELETE_BLOCKED_COUNT_PARAM] || "", 10);
  const blockedDeleteCount =
    Number.isFinite(blockedDeleteCountValue) && blockedDeleteCountValue > 0 ? blockedDeleteCountValue : 0;
  const showInvoiceDeleteNotice = isInvoiceFirstDeleteNotice(deleteNotice);
  const pageSize = 20;
  const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
  const username = (session.user.name || "").trim().toLowerCase();
  const canDeleteSales = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "DELETE",
    module: "SALES",
  });
  const canManageInvoiceRows = canDeleteSales && isInvoiceListTab;
  const toSearchDate = (value: Date | null | undefined) =>
    value ? new Date(value).toISOString().slice(0, 10) : "";
  const toSearchAmount = (value: number | null | undefined) => {
    if (!Number.isFinite(Number(value))) return "";
    return Number(value).toFixed(2);
  };
  const matchesTextFilters = (searchableText: string) => {
    const normalized = searchableText.toLowerCase();
    const matchesSearch = !query || normalized.includes(query);
    const matchesCustomFilter = !customFilter || normalized.includes(customFilter);
    return matchesSearch && matchesCustomFilter;
  };
  const newQuotationHref = quotations[0]?.crmLeadId ? `/crm/${quotations[0].crmLeadId}/quotations/new` : "/crm";
  const newProjectHref = "/crm/projects/new?next=%2Fcrm%2Fquotations%3Ftab%3Dprojects";
  const newActionHref = isProjectsTab ? newProjectHref : newQuotationHref;
  const newActionLabel = isProjectsTab ? "New Project" : "New";

  try {
    invoiceRows = await db.$queryRaw<InvoiceRow[]>`
      SELECT
        i."id" AS "invoiceId",
        q."id" AS "quotationId",
        q."crmLeadId",
        CONCAT('INV/', EXTRACT(YEAR FROM q."createdAt")::text, '/', REPLACE(q."quotationNo", 'QT-', '')) AS "invoiceRef",
        q."quotationNo" AS "orderNo",
        q."clientName",
        q."clientEmail",
        l."phone" AS "clientPhone",
        COALESCE(NULLIF(q."serviceName", ''), NULLIF(q."projectTitle", ''), NULLIF(q."title", ''), 'Service') AS "productName",
        q."projectTitle",
        u."name" AS "salespersonName",
        i."paymentType"::text AS "paymentType",
        i."balanceAmount",
        q."status",
        q."totalAmount",
        i."createdAt"
      FROM "crm_quotation_invoices" i
      INNER JOIN "crm_quotations" q
        ON q."id" = i."quotationId"
      LEFT JOIN "crm_leads" l
        ON l."id" = q."crmLeadId"
      LEFT JOIN "users" u
        ON u."id" = q."createdById"
      ORDER BY i."createdAt" DESC
    `;
  } catch {
    invoiceRows = [];
    dbErrorMessage = dbErrorMessage || "Database is currently unreachable. Showing cached/empty results.";
  }
  const paymentTypeByQuotationId = invoiceRows.reduce<Record<string, string>>((acc, row) => {
    if (!acc[row.quotationId] && row.paymentType) {
      acc[row.quotationId] = row.paymentType;
    }
    return acc;
  }, {});
  const quotationStatusOptions = Array.from(
    new Set(
      [...quotations, ...deletedQuotations]
        .map((quotation) => (quotation.status || "").trim().toUpperCase())
        .filter(Boolean),
    ),
  ).sort((left, right) => formatFilterLabel(left).localeCompare(formatFilterLabel(right)));
  const salespersonOptions = Array.from(
    new Set(
      [...quotations, ...deletedQuotations]
        .map((quotation) => (quotation.salespersonName || "Unassigned").trim() || "Unassigned")
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const customerOptions = Array.from(
    new Set(
      [...quotations, ...deletedQuotations]
        .map((quotation) => (quotation.clientName || "Unknown").trim() || "Unknown")
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const paymentMethodOptions = Array.from(
    new Set(
      [...quotations, ...deletedQuotations]
        .map((quotation) => (paymentTypeByQuotationId[quotation.id] || "Unspecified").trim() || "Unspecified")
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
  const confirmedSalesStatuses = new Set(["SENT", "CONFIRMED", "SALES_ORDER", "ORDERED"]);
  const draftQuotationStatuses = new Set(["DRAFT"]);
  const filteredQuotations = quotations
    .filter((quotation) => {
      if (leadFilterId && quotation.crmLeadId !== leadFilterId) {
        return false;
      }
      const normalizedStatus = (quotation.status || "").toUpperCase();
      const paymentType = paymentTypeByQuotationId[quotation.id] || "";
      const normalizedSalesperson = (quotation.salespersonName || "Unassigned").trim() || "Unassigned";
      const normalizedCustomer = (quotation.clientName || "Unknown").trim() || "Unknown";
      const normalizedPaymentMethod = paymentType.trim() || "Unspecified";
      const searchableText = [
        quotation.quotationNo,
        quotation.title,
        quotation.clientName,
        quotation.clientEmail,
        quotation.projectTitle,
        quotation.serviceName || "",
        quotation.salespersonName || "",
        quotation.status,
        paymentType,
        toSearchAmount(quotation.totalAmount),
        toSearchDate(quotation.createdAt),
      ].join(" ");

      const matchesUser =
        filterPreset !== "my_quotations" ||
        !username ||
        (quotation.salespersonName || "").toLowerCase().includes(username);
      const matchesPreset =
        filterPreset !== "unconfirmed_quotations" ||
        draftQuotationStatuses.has(normalizedStatus);
      const shouldFilterOrders = selectedOrderTab === "orders" || documentType === "sales_orders";
      const matchesDocument =
        !shouldFilterOrders ||
        confirmedSalesStatuses.has(normalizedStatus);
      const matchesStatus =
        quotationStatusValues.length === 0 || quotationStatusValues.includes(normalizedStatus);
      const matchesSalesperson =
        salespersonFilterValues.length === 0 || salespersonFilterValues.includes(normalizedSalesperson);
      const matchesCustomer =
        customerFilterValues.length === 0 || customerFilterValues.includes(normalizedCustomer);
      const matchesPaymentMethod =
        paymentMethodFilterValues.length === 0 || paymentMethodFilterValues.includes(normalizedPaymentMethod);
      const matchesDateRange = matchesRelativeDateRange(quotation.createdAt, quotationDateRange);
      return (
        matchesTextFilters(searchableText) &&
        matchesUser &&
        matchesPreset &&
        matchesDocument &&
        matchesStatus &&
        matchesSalesperson &&
        matchesCustomer &&
        matchesPaymentMethod &&
        matchesDateRange
      );
    })
    .sort((a, b) => {
      if (groupBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      if (groupBy === "salesperson") {
        return (a.salespersonName || "").localeCompare(b.salespersonName || "");
      }
      if (groupBy === "customer") {
        return a.clientName.localeCompare(b.clientName);
      }
      if (groupBy === "payment_method") {
        return (paymentTypeByQuotationId[a.id] || "").localeCompare(paymentTypeByQuotationId[b.id] || "");
      }
      if (groupBy === "order_date" || dateField === "create_date") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0;
    });
  const filteredDeletedQuotations = deletedQuotations
    .filter((quotation) => {
      if (leadFilterId && quotation.crmLeadId !== leadFilterId) {
        return false;
      }
      const normalizedStatus = (quotation.status || "").toUpperCase();
      const normalizedSalesperson = (quotation.salespersonName || "Unassigned").trim() || "Unassigned";
      const normalizedCustomer = (quotation.clientName || "Unknown").trim() || "Unknown";
      const normalizedPaymentMethod = (paymentTypeByQuotationId[quotation.id] || "").trim() || "Unspecified";
      const searchableText = [
        quotation.quotationNo,
        quotation.title,
        quotation.clientName,
        quotation.salespersonName || "",
        quotation.status,
        toSearchAmount(quotation.totalAmount),
        toSearchDate(quotation.deletedAt),
      ].join(" ");

      const matchesUser =
        isDeletedQuotationView ||
        filterPreset !== "my_quotations" ||
        !username ||
        (quotation.salespersonName || "").toLowerCase().includes(username);
      const matchesPreset =
        filterPreset !== "unconfirmed_quotations" ||
        draftQuotationStatuses.has(normalizedStatus);
      const shouldFilterOrders = selectedOrderTab === "orders" || documentType === "sales_orders";
      const matchesDocument =
        !shouldFilterOrders ||
        confirmedSalesStatuses.has(normalizedStatus);
      const matchesStatus =
        quotationStatusValues.length === 0 || quotationStatusValues.includes(normalizedStatus);
      const matchesSalesperson =
        salespersonFilterValues.length === 0 || salespersonFilterValues.includes(normalizedSalesperson);
      const matchesCustomer =
        customerFilterValues.length === 0 || customerFilterValues.includes(normalizedCustomer);
      const matchesPaymentMethod =
        paymentMethodFilterValues.length === 0 || paymentMethodFilterValues.includes(normalizedPaymentMethod);
      const matchesDateRange = matchesRelativeDateRange(quotation.deletedAt, quotationDateRange);
      return (
        matchesTextFilters(searchableText) &&
        matchesUser &&
        matchesPreset &&
        matchesDocument &&
        matchesStatus &&
        matchesSalesperson &&
        matchesCustomer &&
        matchesPaymentMethod &&
        matchesDateRange
      );
    })
    .sort((a, b) => {
      if (groupBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      if (groupBy === "salesperson") {
        return (a.salespersonName || "").localeCompare(b.salespersonName || "");
      }
      if (groupBy === "customer") {
        return a.clientName.localeCompare(b.clientName);
      }
      return new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime();
    });
  const invoiceQuotationIds = new Set(invoiceRows.map((row) => row.quotationId));
  const invoiceListRows = invoiceRows.filter((row) => {
    const normalizedStatus = (row.status || "").toUpperCase();
    const normalizedSalesperson = (row.salespersonName || "Unassigned").trim() || "Unassigned";
    const normalizedCustomer = (row.clientName || "Unknown").trim() || "Unknown";
    const normalizedPaymentMethod = (row.paymentType || "").trim() || "Unspecified";
    const searchableText = [
      row.invoiceRef,
      row.orderNo,
      row.clientName,
      row.clientEmail,
      row.clientPhone || "",
      row.productName,
      row.projectTitle,
      row.salespersonName || "",
      row.paymentType || "",
      row.status,
      toSearchAmount(row.totalAmount),
      toSearchDate(row.createdAt),
    ].join(" ");
    const matchesStatus =
      quotationStatusValues.length === 0 || quotationStatusValues.includes(normalizedStatus);
    const matchesSalesperson =
      salespersonFilterValues.length === 0 || salespersonFilterValues.includes(normalizedSalesperson);
    const matchesCustomer =
      customerFilterValues.length === 0 || customerFilterValues.includes(normalizedCustomer);
    const matchesPaymentMethod =
      paymentMethodFilterValues.length === 0 || paymentMethodFilterValues.includes(normalizedPaymentMethod);
    const matchesDateRange = matchesRelativeDateRange(row.createdAt, quotationDateRange);
    return (
      matchesTextFilters(searchableText) &&
      matchesStatus &&
      matchesSalesperson &&
      matchesCustomer &&
      matchesPaymentMethod &&
      matchesDateRange
    );
  });
  const ordersToInvoiceRows = filteredQuotations
    .filter(
      (quotation) =>
        confirmedSalesStatuses.has((quotation.status || "").toUpperCase()) &&
        !invoiceQuotationIds.has(quotation.id),
    )
    .map((quotation) => {
      const product = getPreferredProductName(quotation.serviceName, quotation.projectTitle, quotation.title);
      return {
        quotationId: quotation.id,
        orderId: quotation.quotationNo,
        customerName: quotation.clientName,
        customerEmail: quotation.clientEmail,
        opportunityName: quotation.title,
        projectTitle: quotation.projectTitle,
        serviceName: quotation.serviceName,
        product,
        salespersonName: quotation.salespersonName,
        orderStatus: quotation.status,
        orderDateLabel: new Date(quotation.createdAt).toLocaleDateString(),
        totalLabel: currency.format(Number(quotation.totalAmount || 0)),
        invoiceStatus: "Not Generated",
        generateInvoiceHref: `/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice/create`,
        viewOrderHref: `/crm/${quotation.crmLeadId}/quotations/${quotation.id}`,
        sendInvoiceHref: `/crm/${quotation.crmLeadId}/quotations/${quotation.id}/invoice`,
      };
    });
  const upsellRows = invoiceRows
    .filter(
      (row) =>
        confirmedSalesStatuses.has((row.status || "").toUpperCase()) &&
        Number(row.balanceAmount || 0) <= 0,
    )
    .map((row) => {
      const suggestedUpgradeProduct = getSuggestedUpgradeProduct(row.productName);
      const opportunityStatus = getUpsellOpportunityStatus(row.createdAt, row.totalAmount);
      return {
        quotationId: row.quotationId,
        customerName: row.clientName,
        previousProductPurchased: row.productName,
        suggestedUpgradeProduct,
        salesperson: row.salespersonName || "Unassigned",
        paymentMethod: row.paymentType || "Unspecified",
        status: row.status || "CONFIRMED",
        createdAt: row.createdAt,
        opportunityStatus,
        opportunityHref: `/crm/${row.crmLeadId}?from=%2Fcrm%2Fquotations%3Ftab%3Dorders-to-upsell&label=Orders%20to%20Upsell`,
        contactHref: buildPreferredContactHref({
          email: row.clientEmail,
          phone: row.clientPhone,
          subject: `Upsell opportunity for ${row.clientName}`,
          body: `Hi ${row.clientName},\r\n\r\nThanks for choosing ${row.productName}. We would like to discuss ${suggestedUpgradeProduct} as your next step.\r\n\r\nRegards,\r\nSales Team`,
        }),
        newSalesOrderHref: `/crm/${row.crmLeadId}/quotations/new`,
      };
    })
    .filter((row) =>
      {
        const normalizedStatus = (row.status || "").toUpperCase();
        const matchesStatus =
          quotationStatusValues.length === 0 || quotationStatusValues.includes(normalizedStatus);
        const matchesSalesperson =
          salespersonFilterValues.length === 0 || salespersonFilterValues.includes(row.salesperson);
        const matchesCustomer =
          customerFilterValues.length === 0 || customerFilterValues.includes(row.customerName);
        const matchesPaymentMethod =
          paymentMethodFilterValues.length === 0 || paymentMethodFilterValues.includes(row.paymentMethod);
        const matchesDateRange = matchesRelativeDateRange(row.createdAt, quotationDateRange);
        return (
          matchesTextFilters(
            [
              row.customerName,
              row.previousProductPurchased,
              row.suggestedUpgradeProduct,
              row.salesperson,
              row.paymentMethod,
              row.status,
              row.opportunityStatus,
            ].join(" "),
          ) &&
          matchesStatus &&
          matchesSalesperson &&
          matchesCustomer &&
          matchesPaymentMethod &&
          matchesDateRange
        );
      },
    );
  let deletedInvoiceRows: Array<{
    invoiceId: string;
    quotationId: string;
    crmLeadId: string;
    invoiceRef: string;
    orderNo: string;
    clientName: string;
    salespersonName: string | null;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }> = [];
  if (isDeletedInvoiceView) {
    try {
      deletedInvoiceRows = await db.$queryRaw<
        Array<{
          invoiceId: string;
          quotationId: string;
          crmLeadId: string;
          invoiceRef: string;
          orderNo: string;
          clientName: string;
          salespersonName: string | null;
          status: string;
          totalAmount: number;
          createdAt: Date;
        }>
      >`
        SELECT
          d."invoiceId",
          d."quotationId",
          d."crmLeadId",
          d."invoiceRef",
          d."orderNo",
          d."clientName",
          d."salespersonName",
          d."status",
          d."totalAmount",
          d."deletedAt" AS "createdAt"
        FROM "crm_deleted_invoices" d
        ORDER BY d."deletedAt" DESC
      `;
    } catch {
      deletedInvoiceRows = [];
    }
  }
  const filteredDeletedRows = deletedInvoiceRows.filter((row) => {
    const searchableText = [
      row.invoiceRef,
      row.orderNo,
      row.clientName,
      row.salespersonName || "",
      row.status,
      toSearchAmount(row.totalAmount),
      toSearchDate(row.createdAt),
    ].join(" ");
    return matchesTextFilters(searchableText);
  });
  const totalItems = isToInvoiceTab
    ? isDeletedInvoiceView
      ? filteredDeletedRows.length
      : isInvoiceListTab
        ? invoiceListRows.length
        : isOrdersToInvoiceTab
          ? ordersToInvoiceRows.length
          : upsellRows.length
    : isDeletedQuotationView
      ? filteredDeletedQuotations.length
      : filteredQuotations.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requestedPage = Number(params.page || "1");
  const currentPage = Number.isFinite(requestedPage)
    ? Math.min(Math.max(1, Math.trunc(requestedPage)), totalPages)
    : 1;
  const startIndex = (currentPage - 1) * pageSize;
  const pagedQuotations = filteredQuotations.slice(startIndex, startIndex + pageSize);
  const pagedDeletedQuotations = filteredDeletedQuotations.slice(startIndex, startIndex + pageSize);
  const pagedInvoiceListRows = invoiceListRows.slice(startIndex, startIndex + pageSize);
  const pagedOrdersToInvoiceRows = ordersToInvoiceRows.slice(startIndex, startIndex + pageSize);
  const pagedUpsellRows = upsellRows.slice(startIndex, startIndex + pageSize);
  const pagedToInvoiceRowsView = pagedInvoiceListRows.map((row) => ({
    ...row,
    totalLabel: currency.format(row.totalAmount),
    createdLabel: new Date(row.createdAt).toLocaleDateString(),
  }));
  const rangeStart = totalItems === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + pageSize, totalItems);
  const statusBuckets = filteredQuotations.reduce<Record<string, number>>((acc, quotation) => {
    const key = quotation.status || "UNKNOWN";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const calendarBuckets = pagedQuotations.reduce<Record<string, typeof pagedQuotations>>((acc, quotation) => {
    const dateKey = new Date(quotation.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(quotation);
    return acc;
  }, {});
  const customerBuckets = pagedQuotations.reduce<
    Record<string, { client: string; count: number; total: number; quotations: string[] }>
  >((acc, quotation) => {
    const key = quotation.clientName || "Unknown";
    if (!acc[key]) acc[key] = { client: key, count: 0, total: 0, quotations: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].quotations.push(quotation.quotationNo);
    return acc;
  }, {});
  const customerDetails = filteredQuotations.reduce<
    Record<string, { name: string; count: number; total: number; lastDate: number; quotationIds: string[] }>
  >((acc, quotation) => {
    const key = quotation.clientName || "Unknown";
    if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0, quotationIds: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
    acc[key].quotationIds.push(quotation.id);
    return acc;
  }, {});
  const salesTeamDetails = filteredQuotations.reduce<
    Record<string, { name: string; count: number; total: number; lastDate: number; quotationIds: string[] }>
  >((acc, quotation) => {
    const key = quotation.salespersonName || "Unassigned";
    if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0, quotationIds: [] };
    acc[key].count += 1;
    acc[key].total += Number(quotation.totalAmount || 0);
    acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
    acc[key].quotationIds.push(quotation.id);
    return acc;
  }, {});
  const pageTitle = isOrderTab
    ? selectedOrderLabel
    : tabLabelMap[activeTab] || (isToInvoiceTab ? selectedToInvoiceLabel : selectedOrderLabel);
  const displayTitle = isDeletedQuotationView
    ? `Deleted ${salesDocumentPluralLabel}`
    : isDeletedInvoiceView
      ? "Deleted Invoices"
      : pageTitle;
  const confirmedStatuses = confirmedSalesStatuses;
  const draftStatuses = new Set(["DRAFT"]);
  const sentStatuses = new Set(["SENT"]);
  const reportingRows = filteredQuotations;
  const reportingRowCount = reportingRows.length;
  const reportingTotalValue = reportingRows.reduce((sum, quotation) => sum + Number(quotation.totalAmount || 0), 0);
  const confirmedRows = reportingRows.filter((quotation) => confirmedStatuses.has((quotation.status || "").toUpperCase()));
  const confirmedValue = confirmedRows.reduce((sum, quotation) => sum + Number(quotation.totalAmount || 0), 0);
  const draftRows = reportingRows.filter((quotation) => draftStatuses.has((quotation.status || "").toUpperCase()));
  const sentRows = reportingRows.filter((quotation) => sentStatuses.has((quotation.status || "").toUpperCase()));
  const averageQuotationValue = reportingRowCount > 0 ? reportingTotalValue / reportingRowCount : 0;
  const conversionRate = reportingRowCount > 0 ? (confirmedRows.length / reportingRowCount) * 100 : 0;
  const statusSummaryRows = Object.entries(
    reportingRows.reduce<Record<string, { count: number; total: number }>>((acc, quotation) => {
      const key = quotation.status || "UNKNOWN";
      if (!acc[key]) acc[key] = { count: 0, total: 0 };
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      return acc;
    }, {}),
  )
    .map(([status, bucket]) => ({
      status,
      count: bucket.count,
      total: bucket.total,
      share: reportingRowCount > 0 ? (bucket.count / reportingRowCount) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
  const reportingSalespeople = Object.values(
    reportingRows.reduce<
      Record<string, { name: string; count: number; total: number; confirmed: number; lastDate: number }>
    >((acc, quotation) => {
      const key = quotation.salespersonName || "Unassigned";
      if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, confirmed: 0, lastDate: 0 };
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      if (confirmedStatuses.has((quotation.status || "").toUpperCase())) {
        acc[key].confirmed += 1;
      }
      acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);
  const reportingCustomers = Object.values(
    reportingRows.reduce<Record<string, { name: string; count: number; total: number; lastDate: number }>>(
      (acc, quotation) => {
        const key = quotation.clientName || "Unknown";
        if (!acc[key]) acc[key] = { name: key, count: 0, total: 0, lastDate: 0 };
        acc[key].count += 1;
        acc[key].total += Number(quotation.totalAmount || 0);
        acc[key].lastDate = Math.max(acc[key].lastDate, new Date(quotation.createdAt).getTime());
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b.total - a.total);
  const reportingMonthlyTrend = Object.values(
    reportingRows.reduce<
      Record<string, { key: string; label: string; count: number; total: number; confirmed: number }>
    >((acc, quotation) => {
      const createdAt = new Date(quotation.createdAt);
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          label: createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          count: 0,
          total: 0,
          confirmed: 0,
        };
      }
      acc[key].count += 1;
      acc[key].total += Number(quotation.totalAmount || 0);
      if (confirmedStatuses.has((quotation.status || "").toUpperCase())) {
        acc[key].confirmed += 1;
      }
      return acc;
    }, {}),
  )
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-6);
  const reportingRecentRows = [...reportingRows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
  const mergedProjectItems: ProjectTypesList = [
    ...projectTypes,
    ...projectRows
      .filter((project) => !projectTypes.some((item) => item.name.toLowerCase() === project.name.toLowerCase()))
      .map((project) => ({
        id: project.id,
        name: project.name,
        budget: Number(project.price || 0),
        category: (project.category || "Other").trim() || "Other",
        gstPercent: Number(project.gstPercent || 18),
        status: project.status || "Active",
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      })),
  ];
  const projectCategories = Array.from(
    new Set(mergedProjectItems.map((item) => (item.category || "Other").trim() || "Other"))
  ).sort((a, b) => a.localeCompare(b));
  const projectStatusOptions = Array.from(
    new Set(mergedProjectItems.map((item) => (item.status || "Active").trim() || "Active")),
  ).sort((left, right) => formatFilterLabel(left).localeCompare(formatFilterLabel(right)));
  const filteredProjectTypes = mergedProjectItems.filter((item) => {
    if (!isProjectsTab) return true;
    const normalizedCategory = (item.category || "Other").trim() || "Other";
    const normalizedStatus = (item.status || "Active").trim() || "Active";
    const searchableText = [
      item.name,
      normalizedCategory,
      normalizedStatus,
      toSearchAmount(item.budget),
      toSearchDate(item.createdAt),
      toSearchDate(item.updatedAt),
    ].join(" ");
    const matchesText = matchesTextFilters(searchableText);
    const matchesCategory =
      projectCategoryValues.length === 0 || projectCategoryValues.includes(normalizedCategory);
    const matchesBudgetPreset =
      projectBudgetRangeValues.length === 0 ||
      projectBudgetRangeValues.some((range) => {
        if (range === "lte_5000") return item.budget <= 5000;
        if (range === "range_5001_20000") return item.budget >= 5001 && item.budget <= 20000;
        if (range === "gte_20001") return item.budget >= 20001;
        return false;
      });
    const matchesBudgetMin = !Number.isFinite(budgetMin) || item.budget >= budgetMin;
    const matchesBudgetMax = !Number.isFinite(budgetMax) || item.budget <= budgetMax;
    const matchesStatus =
      projectStatusValues.length === 0 || projectStatusValues.includes(normalizedStatus);
    const matchesDateRange = matchesRelativeDateRange(item.createdAt, projectDateRange);
    return (
      matchesText &&
      matchesCategory &&
      matchesBudgetPreset &&
      matchesBudgetMin &&
      matchesBudgetMax &&
      matchesStatus &&
      matchesDateRange
    );
  });
  const projectViewItems = [...filteredProjectTypes].sort((a, b) => {
    if (groupBy === "status") {
      return (a.status || "").localeCompare(b.status || "");
    }
    if (groupBy === "category") {
      return (a.category || "Other").localeCompare(b.category || "Other");
    }
    if (groupBy === "budget") {
      return Number(b.budget || 0) - Number(a.budget || 0);
    }
    if (groupBy === "create_date") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (groupBy === "project_name") {
      return a.name.localeCompare(b.name);
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const projectsTotalPages = Math.max(1, Math.ceil(projectViewItems.length / pageSize));
  const uiTotalItems = isProjectsTab ? projectViewItems.length : isReportingTab ? reportingRowCount : totalItems;
  const uiCurrentPage = isProjectsTab || isReportingTab ? 1 : currentPage;
  const uiTotalPages = isProjectsTab ? projectsTotalPages : isReportingTab ? 1 : totalPages;
  const uiRangeStart = isProjectsTab
    ? (projectViewItems.length === 0 ? 0 : 1)
    : isReportingTab
      ? (reportingRowCount === 0 ? 0 : 1)
      : rangeStart;
  const uiRangeEnd = isProjectsTab ? projectViewItems.length : isReportingTab ? reportingRowCount : rangeEnd;

  const pageHref = (
    page: number,
    overrides?: {
      tab?: string;
      view?: string;
      filterPreset?: string;
      documentType?: string;
      dateField?: string;
      customFilter?: string;
      groupBy?: string;
      projectPreset?: string;
      quotationStatus?: string;
      salespersonFilter?: string;
      customerFilter?: string;
      paymentMethodFilter?: string;
      quotationDateRange?: string;
      projectStatus?: string;
      projectDateRange?: string;
      deleted?: string;
      q?: string;
      projectCategory?: string;
      projectBudgetRanges?: string;
      budgetMin?: string;
      budgetMax?: string;
      leadId?: string;
      leadName?: string;
      clearFilters?: boolean;
    }
  ) => {
    const next = new URLSearchParams();

    const filterPresetValue = overrides?.filterPreset ?? (overrides?.clearFilters ? undefined : params.filterPreset);
    const documentTypeValue = overrides?.documentType ?? (overrides?.clearFilters ? undefined : params.documentType);
    const dateFieldValue = overrides?.dateField ?? (overrides?.clearFilters ? undefined : params.dateField);
    const customFilterValue = overrides?.customFilter ?? (overrides?.clearFilters ? undefined : params.customFilter);
    const groupByValue = overrides?.groupBy ?? (overrides?.clearFilters ? undefined : params.groupBy);
    const projectPresetValue = overrides?.projectPreset ?? (overrides?.clearFilters ? undefined : params.projectPreset);
    const deletedValue = overrides?.deleted ?? (overrides?.clearFilters ? undefined : params.deleted);
    const quotationStatusValue =
      overrides?.quotationStatus ?? (overrides?.clearFilters ? undefined : params.quotationStatus);
    const salespersonFilterValue =
      overrides?.salespersonFilter ?? (overrides?.clearFilters ? undefined : params.salespersonFilter);
    const customerFilterValue =
      overrides?.customerFilter ?? (overrides?.clearFilters ? undefined : params.customerFilter);
    const paymentMethodFilterValue =
      overrides?.paymentMethodFilter ?? (overrides?.clearFilters ? undefined : params.paymentMethodFilter);
    const quotationDateRangeValue =
      overrides?.quotationDateRange ?? (overrides?.clearFilters ? undefined : params.quotationDateRange);
    const projectStatusValue =
      overrides?.projectStatus ?? (overrides?.clearFilters ? undefined : params.projectStatus);
    const projectDateRangeValue =
      overrides?.projectDateRange ?? (overrides?.clearFilters ? undefined : params.projectDateRange);
    const projectCategoryValue =
      overrides?.projectCategory ?? (overrides?.clearFilters ? undefined : params.projectCategory);
    const projectBudgetRangesValue =
      overrides?.projectBudgetRanges ?? (overrides?.clearFilters ? undefined : params.projectBudgetRanges);
    const budgetMinValue = overrides?.budgetMin ?? (overrides?.clearFilters ? undefined : params.budgetMin);
    const budgetMaxValue = overrides?.budgetMax ?? (overrides?.clearFilters ? undefined : params.budgetMax);
    const leadIdValue = overrides?.leadId ?? (overrides?.clearFilters ? undefined : params.leadId);
    const leadNameValue = overrides?.leadName ?? (overrides?.clearFilters ? undefined : params.leadName);

    if (filterPresetValue && filterPresetValue !== "my_quotations") next.set("filterPreset", filterPresetValue);
    if (documentTypeValue && documentTypeValue !== "quotations") next.set("documentType", documentTypeValue);
    if (dateFieldValue && dateFieldValue !== "create_date") next.set("dateField", dateFieldValue);
    if (customFilterValue) next.set("customFilter", customFilterValue);
    if (groupByValue) next.set("groupBy", groupByValue);
    if (projectPresetValue) next.set("projectPreset", projectPresetValue);
    if (deletedValue === "1") next.set("deleted", "1");
    if (quotationStatusValue) next.set("quotationStatus", quotationStatusValue);
    if (salespersonFilterValue) next.set("salespersonFilter", salespersonFilterValue);
    if (customerFilterValue) next.set("customerFilter", customerFilterValue);
    if (paymentMethodFilterValue) next.set("paymentMethodFilter", paymentMethodFilterValue);
    if (quotationDateRangeValue) next.set("quotationDateRange", quotationDateRangeValue);
    if (projectStatusValue) next.set("projectStatus", projectStatusValue);
    if (projectDateRangeValue) next.set("projectDateRange", projectDateRangeValue);
    if (projectCategoryValue) next.set("projectCategory", projectCategoryValue);
    if (projectBudgetRangesValue) next.set("projectBudgetRanges", projectBudgetRangesValue);
    if (budgetMinValue) next.set("budgetMin", budgetMinValue);
    if (budgetMaxValue) next.set("budgetMax", budgetMaxValue);
    if (leadIdValue) next.set("leadId", leadIdValue);
    if (leadNameValue) next.set("leadName", leadNameValue);

    const qValue = overrides?.q ?? params.q;
    if (qValue && qValue.trim()) next.set("q", qValue.trim());

    const tabValue = overrides?.tab || activeTab;
    const viewValue = overrides?.view || activeView;
    if (tabValue && tabValue !== "quotations") next.set("tab", tabValue);
    if (viewValue && viewValue !== "list") next.set("view", viewValue);
    if (page > 1) next.set("page", String(page));
    const queryString = next.toString();
    return queryString ? `/crm/quotations?${queryString}` : "/crm/quotations";
  };

  const viewLabelByKey: Record<SalesViewKey, string> = {
    list: "List view",
    kanban: "Kanban view",
    map: "Map view",
    calendar: "Calendar view",
    table: "Table view",
    chart: "Chart view",
    history: "History view",
  };
  const availableViewKeys: SalesViewKey[] = isDeletedQuotationView
    ? ["list", "table"]
    : isQuotationLikeTab
    ? ["list", "kanban", "map", "calendar", "table", "chart", "history"]
    : isProjectsTab
      ? ["list", "kanban", "map", "calendar", "table", "chart", "history"]
      : isReportingTab
        ? ["list", "table", "chart", "history"]
      : isToInvoiceTab
        ? ["list", "kanban", "table"]
        : selectedOrderTab === "sales-teams" || selectedOrderTab === "customers"
          ? ["list", "kanban", "table"]
          : ["list"];
  const currentViewMode: SalesViewKey = availableViewKeys.includes(viewMode as SalesViewKey)
    ? (viewMode as SalesViewKey)
    : availableViewKeys[0];
  const availableViews = availableViewKeys.map((key) => ({
    key,
    label: viewLabelByKey[key],
    href: pageHref(1, { view: key }),
  }));
  const currentPageHref = pageHref(currentPage);
  const deleteNoticeDismissHref = currentPageHref;
  const deleteNoticeInvoiceHref = pageHref(1, {
    tab: "to-invoice",
    view: "list",
    documentType: "sales_orders",
    deleted: "",
    q: blockedDeleteRef || "",
  });
  const deleteNoticeTitle = blockedDeleteRef
    ? `This ${salesDocumentLabelLower} already has an invoice`
    : blockedDeleteCount > 1
      ? `${blockedDeleteCount} ${salesDocumentPluralLabelLower} already have invoices`
      : `Delete the invoice before deleting this ${salesDocumentLabelLower}`;
  const deleteNoticeDescription = blockedDeleteRef
    ? `Open To Invoice, delete the invoice linked to ${blockedDeleteRef}, then come back here and delete the ${salesDocumentLabelLower}.`
    : blockedDeleteCount > 1
      ? `Some selected ${salesDocumentPluralLabelLower} are already linked to invoices. Remove those invoices first in To Invoice, then delete the ${salesDocumentPluralLabelLower}.`
      : `This ${salesDocumentLabelLower} is already linked to an invoice. Remove the invoice first in To Invoice, then delete the ${salesDocumentLabelLower}.`;

  const activeFilterChips: Array<{ key: string; label: string; href: string; icon?: "group" | "filter" }> = [];
  if (isProjectsTab) {
    if (projectPreset === "all_projects") {
      activeFilterChips.push({
        key: "projectPreset",
        label: "All Projects",
        href: pageHref(1, { projectPreset: "" }),
        icon: "filter",
      });
    }
    projectCategoryValues.forEach((category) => {
      const nextCategories = projectCategoryValues.filter((value) => value !== category);
      activeFilterChips.push({
        key: `projectCategory-${category}`,
        label: category,
        href: pageHref(1, { projectCategory: nextCategories.join(",") }),
        icon: "filter",
      });
    });
    projectBudgetRangeValues.forEach((range) => {
      const nextRanges = projectBudgetRangeValues.filter((value) => value !== range);
      const rangeLabel =
        range === "lte_5000"
          ? "Budget <= 5,000"
          : range === "range_5001_20000"
            ? "Budget 5,001 - 20,000"
            : "Budget >= 20,001";
      activeFilterChips.push({
        key: `projectBudgetRange-${range}`,
        label: rangeLabel,
        href: pageHref(1, { projectBudgetRanges: nextRanges.join(",") }),
        icon: "filter",
      });
    });
    projectStatusValues.forEach((status) => {
      const nextStatuses = projectStatusValues.filter((value) => value !== status);
      activeFilterChips.push({
        key: `projectStatus-${status}`,
        label: `Status: ${formatFilterLabel(status)}`,
        href: pageHref(1, { projectStatus: nextStatuses.join(",") }),
        icon: "filter",
      });
    });
    if (Number.isFinite(budgetMin)) {
      activeFilterChips.push({
        key: "budgetMin",
        label: `Min Budget: ${budgetMin}`,
        href: pageHref(1, { budgetMin: "" }),
      });
    }
    if (Number.isFinite(budgetMax)) {
      activeFilterChips.push({
        key: "budgetMax",
        label: `Max Budget: ${budgetMax}`,
        href: pageHref(1, { budgetMax: "" }),
      });
    }
    if (groupBy) {
      const groupByLabel =
        groupBy === "project_name"
          ? "Project Name"
          : groupBy === "status"
            ? "Status"
          : groupBy === "category"
            ? "Category"
            : groupBy === "budget"
              ? "Budget"
              : groupBy === "create_date"
                ? "Create Date"
                : groupBy;
      activeFilterChips.push({
        key: "projectGroupBy",
        label: groupByLabel,
        href: pageHref(1, { groupBy: "" }),
        icon: "group",
      });
    }
    if (projectDateRange) {
      activeFilterChips.push({
        key: "projectDateRange",
        label: `Date: ${formatDateRangeLabel(projectDateRange)}`,
        href: pageHref(1, { projectDateRange: "" }),
        icon: "filter",
      });
    }
    if (customFilter) {
      activeFilterChips.push({
        key: "projectCustomFilter",
        label: `Custom: ${customFilter}`,
        href: pageHref(1, { customFilter: "" }),
      });
    }
  } else {
    const rawFilterPreset = (params.filterPreset || "").toLowerCase();
    const rawDocumentType = (params.documentType || "").toLowerCase();

    if (leadFilterId) {
      activeFilterChips.push({
        key: "leadFilter",
        label: leadFilterLabel ? `Client: ${leadFilterLabel}` : "Selected Lead",
        href: pageHref(1, { leadId: "", leadName: "" }),
        icon: "filter",
      });
    }
    if (rawFilterPreset === "unconfirmed_quotations") {
      activeFilterChips.push({
        key: "filterPreset",
        label: "Unconfirmed Quotations",
        href: pageHref(1, { filterPreset: "", tab: "quotations", documentType: "quotations" }),
        icon: "filter",
      });
    }
    if (rawDocumentType === "sales_orders") {
      activeFilterChips.push({
        key: "documentType",
        label: "Sales Orders",
        href: pageHref(1, { tab: "quotations", documentType: "" }),
        icon: "filter",
      });
    }
    quotationStatusValues.forEach((status) => {
      const nextStatuses = quotationStatusValues.filter((value) => value !== status);
      activeFilterChips.push({
        key: `quotationStatus-${status}`,
        label: `Status: ${formatFilterLabel(status)}`,
        href: pageHref(1, { quotationStatus: nextStatuses.join(",") }),
        icon: "filter",
      });
    });
    salespersonFilterValues.forEach((salesperson) => {
      const nextSalespeople = salespersonFilterValues.filter((value) => value !== salesperson);
      activeFilterChips.push({
        key: `salespersonFilter-${salesperson}`,
        label: `Salesperson: ${salesperson}`,
        href: pageHref(1, { salespersonFilter: nextSalespeople.join(",") }),
        icon: "filter",
      });
    });
    customerFilterValues.forEach((customer) => {
      const nextCustomers = customerFilterValues.filter((value) => value !== customer);
      activeFilterChips.push({
        key: `customerFilter-${customer}`,
        label: `Customer: ${customer}`,
        href: pageHref(1, { customerFilter: nextCustomers.join(",") }),
        icon: "filter",
      });
    });
    paymentMethodFilterValues.forEach((paymentMethod) => {
      const nextMethods = paymentMethodFilterValues.filter((value) => value !== paymentMethod);
      activeFilterChips.push({
        key: `paymentMethodFilter-${paymentMethod}`,
        label: `Payment: ${paymentMethod}`,
        href: pageHref(1, { paymentMethodFilter: nextMethods.join(",") }),
        icon: "filter",
      });
    });
    if (quotationDateRange) {
      activeFilterChips.push({
        key: "quotationDateRange",
        label: `Date: ${formatDateRangeLabel(quotationDateRange)}`,
        href: pageHref(1, { quotationDateRange: "" }),
        icon: "filter",
      });
    }
    if (groupBy) {
      const groupByLabel =
        groupBy === "status"
          ? "Status"
          : groupBy === "salesperson"
            ? "Salesperson"
          : groupBy === "customer"
            ? "Customer"
            : groupBy === "order_date"
              ? "Order Date"
              : groupBy === "payment_method"
                ? "Payment Method"
                : groupBy;
      activeFilterChips.push({
        key: "groupBy",
        label: groupByLabel,
        href: pageHref(1, { groupBy: "" }),
        icon: "group",
      });
    }
    if (customFilter) {
      activeFilterChips.push({
        key: "customFilter",
        label: `Custom: ${customFilter}`,
        href: pageHref(1, { customFilter: "" }),
      });
    }
  }

  const sortedCustomerDetails = Object.values(customerDetails).sort((a, b) => b.total - a.total);
  const sortedSalesTeamDetails = Object.values(salesTeamDetails).sort((a, b) => b.total - a.total);
  const groupedQuotationKanbanColumns = isQuotationLikeTab && groupBy
    ? Object.values(
        pagedQuotations.reduce<
          Record<
            string,
            {
              key: string;
              label: string;
              count: number;
              total: number;
              quotations: typeof pagedQuotations;
            }
          >
        >((acc, quotation) => {
          const columnLabel =
            groupBy === "status"
              ? quotation.status || "Unknown"
              : groupBy === "salesperson"
              ? quotation.salespersonName || "Unassigned"
              : groupBy === "customer"
                ? quotation.clientName || "Unknown"
                : groupBy === "payment_method"
                  ? paymentTypeByQuotationId[quotation.id] || "Unspecified"
                  : groupBy === "order_date"
                    ? new Date(quotation.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Other";

          if (!acc[columnLabel]) {
            acc[columnLabel] = {
              key: columnLabel,
              label: columnLabel,
              count: 0,
              total: 0,
              quotations: [],
            };
          }

          acc[columnLabel].count += 1;
          acc[columnLabel].total += Number(quotation.totalAmount || 0);
          acc[columnLabel].quotations.push(quotation);
          return acc;
        }, {}),
      ).sort((a, b) => {
        if (groupBy === "order_date") {
          const aDate = a.quotations[0] ? new Date(a.quotations[0].createdAt).getTime() : 0;
          const bDate = b.quotations[0] ? new Date(b.quotations[0].createdAt).getTime() : 0;
          return bDate - aDate;
        }

        if (groupBy === "status" || groupBy === "salesperson" || groupBy === "customer" || groupBy === "payment_method") {
          return a.label.localeCompare(b.label);
        }

        return 0;
      })
    : [];
  const quotationListRows = pagedQuotations.map((quotation) => ({
    id: quotation.id,
    crmLeadId: quotation.crmLeadId,
    quotationNo: quotation.quotationNo,
    title: quotation.title,
    projectName: quotation.serviceName || quotation.projectTitle || quotation.title || "-",
    clientName: quotation.clientName,
    salespersonName: quotation.salespersonName,
    status: quotation.status,
    totalLabel: currency.format(Number(quotation.totalAmount || 0)),
    createdLabel: new Date(quotation.createdAt).toLocaleDateString(),
  }));
  const deletedQuotationListRows = pagedDeletedQuotations.map((quotation) => ({
    id: quotation.id,
    quotationId: quotation.quotationId,
    quotationNo: quotation.quotationNo,
    title: quotation.title,
    clientName: quotation.clientName,
    salespersonName: quotation.salespersonName,
    status: quotation.status,
    totalLabel: currency.format(Number(quotation.totalAmount || 0)),
    deletedLabel: new Date(quotation.deletedAt).toLocaleDateString(),
    href: `/crm/quotations/deleted/${quotation.quotationId}`,
  }));
  const salesTeamRows = sortedSalesTeamDetails.map((team) => ({
    key: team.name,
    name: team.name,
    count: team.count,
    totalLabel: currency.format(team.total),
    lastDateLabel: team.lastDate ? new Date(team.lastDate).toLocaleDateString() : "-",
    quotationIds: team.quotationIds,
    quotationsHref: pageHref(1, { tab: "orders", q: team.name }),
  }));
  const customerRows = sortedCustomerDetails.map((customer) => ({
    key: customer.name,
    name: customer.name,
    count: customer.count,
    totalLabel: currency.format(customer.total),
    lastDateLabel: customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-",
    quotationIds: customer.quotationIds,
    quotationsHref: pageHref(1, { tab: "orders", q: customer.name }),
  }));
  const searchSuggestions = (() => {
    if (isProjectsTab) {
      return projectViewItems.slice(0, 12).map((item) => ({
        id: item.id,
        label: item.name,
        description: `${item.category || "Other"} - ${currency.format(item.budget)}`,
        href: `/crm/projects/${item.id}`,
      }));
    }
    if (isDeletedQuotationView) {
      return filteredDeletedQuotations.slice(0, 12).map((row) => ({
        id: row.id,
        label: row.quotationNo,
        description: `${row.clientName} - ${row.status}`,
        href: `/crm/quotations/deleted/${row.quotationId}`,
      }));
    }
    if (isDeletedInvoiceView) {
      return filteredDeletedRows.slice(0, 12).map((row) => ({
        id: row.invoiceId,
        label: row.invoiceRef,
        description: `${row.clientName} - ${row.status}`,
        href: pageHref(1, { q: row.invoiceRef }),
      }));
    }
    if (isInvoiceListTab) {
      return invoiceListRows.slice(0, 12).map((row) => ({
        id: row.invoiceId,
        label: row.invoiceRef,
        description: `${row.clientName} - ${currency.format(row.totalAmount)}`,
        href: withInternalBackHref(`/crm/${row.crmLeadId}/quotations/${row.quotationId}/invoice`, currentPageHref),
      }));
    }
    if (isOrdersToInvoiceTab) {
      return ordersToInvoiceRows.slice(0, 12).map((row) => ({
        id: row.quotationId,
        label: row.orderId,
        description: `${row.customerName} - ${row.product}`,
        href: withInternalBackHref(row.viewOrderHref, currentPageHref),
      }));
    }
    if (isUpsellTab) {
      return upsellRows.slice(0, 12).map((row) => ({
        id: row.quotationId,
        label: row.customerName,
        description: `${row.previousProductPurchased} - ${row.suggestedUpgradeProduct}`,
        href: row.opportunityHref,
      }));
    }
    if (selectedOrderTab === "sales-teams") {
      return sortedSalesTeamDetails.slice(0, 12).map((team) => ({
        id: team.name,
        label: team.name,
        description: `${team.count} quotations - ${currency.format(team.total)}`,
        href: pageHref(1, { tab: "sales-teams", q: team.name }),
      }));
    }
    if (selectedOrderTab === "customers") {
      return sortedCustomerDetails.slice(0, 12).map((customer) => ({
        id: customer.name,
        label: customer.name,
        description: `${customer.count} quotations - ${currency.format(customer.total)}`,
        href: pageHref(1, { tab: "customers", q: customer.name }),
      }));
    }
    return filteredQuotations.slice(0, 12).map((quotation) => ({
      id: quotation.id,
      label: `${quotation.quotationNo} - ${quotation.title}`,
      description: `${quotation.clientName} - ${currency.format(Number(quotation.totalAmount || 0))}`,
      href: withInternalBackHref(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`, currentPageHref),
    }));
  })();
  const projectCategoryBuckets = projectViewItems.reduce<Record<string, { count: number; total: number }>>((acc, item) => {
    const key = (item.category || "Other").trim() || "Other";
    if (!acc[key]) acc[key] = { count: 0, total: 0 };
    acc[key].count += 1;
    acc[key].total += Number(item.budget || 0);
    return acc;
  }, {});
  const projectCalendarBuckets = projectViewItems.reduce<Record<string, typeof projectViewItems>>((acc, item) => {
    const dateKey = new Date(item.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {});
  const recentProjectHistory = [...projectViewItems]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 30);

  if (isConfigurationTab) {
    return (
      <div className="space-y-3">
        {dbErrorMessage ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {dbErrorMessage}
          </div>
        ) : null}

        <div className="rounded-md border bg-white p-8 text-sm text-slate-600">
          Configuration view is selected. Sales configuration options will appear here.
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="rounded-md border bg-white p-4 text-sm text-slate-500">Loading quotations...</div>}>
      <div
        className={`flex min-h-0 w-full flex-col gap-3 overflow-hidden ${SALES_PAGE_HEIGHT_CLASS} ${SALES_PAGE_BOTTOM_OFFSET_CLASS}`}
      >
      {showInvoiceDeleteNotice ? (
        <div className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white shadow-sm">
          <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{deleteNoticeTitle}</p>
                  {blockedDeleteRef ? (
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                      {blockedDeleteRef}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-700">{deleteNoticeDescription}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={deleteNoticeInvoiceHref}
                className="inline-flex items-center rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Open To Invoice
              </Link>
              <Link
                href={deleteNoticeDismissHref}
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              >
                Dismiss
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {dbErrorMessage ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {dbErrorMessage}
        </div>
      ) : null}

      <div className="rounded-md border bg-white">
        <div className="flex flex-col gap-3 px-4 py-3 xl:grid xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center xl:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap xl:pr-2">
            {!isToInvoiceTab && !isDeletedQuotationView ? (
              <Link
                href={newActionHref}
                className="rounded bg-[#7c5a77] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#6d4f69]"
              >
                {newActionLabel}
              </Link>
            ) : null}
            {(isDeletedQuotationView || isDeletedInvoiceView) ? (
              <Link
                href={
                  isDeletedInvoiceView
                    ? pageHref(1, { tab: "to-invoice", deleted: "" })
                    : pageHref(1, { deleted: "" })
                }
                aria-label={isDeletedQuotationView ? `Back to ${salesDocumentPluralLabelLower}` : "Back to invoices"}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : null}
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-2xl font-semibold text-slate-900">{displayTitle}</span>
              {isProjectsTab ? (
                <CrmProjectsImportExportMenu
                  items={projectViewItems}
                  canImport={session.user.role === "ADMIN"}
                />
              ) : (
                <OrdersToInvoiceSettings
                  isToInvoiceTab={isInvoiceListTab}
                  isQuotationTab={isQuotationLikeTab}
                  isDeletedView={isDeletedInvoiceView || isDeletedQuotationView}
                  activeHref={isInvoiceListTab ? pageHref(1, { tab: "to-invoice", deleted: "" }) : pageHref(1, { deleted: "" })}
                  deletedHref={isInvoiceListTab ? pageHref(1, { tab: "to-invoice", deleted: "1" }) : pageHref(1, { deleted: "1" })}
                  canDelete={isInvoiceListTab || isQuotationLikeTab ? canDeleteSales : false}
                />
              )}
            </div>
          </div>

          {!(isDeletedInvoiceView || isDeletedQuotationView) ? (
            <>
              <div className="min-w-0 xl:flex xl:justify-center">
                <div className="min-w-0 w-full xl:max-w-[820px] 2xl:max-w-[920px]">
                  <OrdersToInvoiceSelectionToolbar
                    isToInvoiceTab={isInvoiceListTab && !isDeletedInvoiceView && canManageInvoiceRows}
                  >
                    <div className="relative flex min-h-11 w-full items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                      <CrmToolbarSearch
                        query={params.q || ""}
                        placeholder="Search..."
                        chips={activeFilterChips}
                        suggestions={searchSuggestions}
                        hiddenFields={{
                          tab: params.tab || "",
                          view: params.view || "",
                          filterPreset: params.filterPreset || "",
                          documentType: params.documentType || "",
                          dateField: params.dateField || "",
                          customFilter: params.customFilter || "",
                          groupBy: params.groupBy || "",
                          projectPreset: params.projectPreset || "",
                          projectCategory: params.projectCategory || "",
                          projectBudgetRanges: params.projectBudgetRanges || "",
                          budgetMin: params.budgetMin || "",
                          budgetMax: params.budgetMax || "",
                          quotationStatus: params.quotationStatus || "",
                          salespersonFilter: params.salespersonFilter || "",
                          customerFilter: params.customerFilter || "",
                          paymentMethodFilter: params.paymentMethodFilter || "",
                          quotationDateRange: params.quotationDateRange || "",
                          projectStatus: params.projectStatus || "",
                          projectDateRange: params.projectDateRange || "",
                          leadId: params.leadId || "",
                          leadName: params.leadName || "",
                          deleted: params.deleted || "",
                        }}
                      />
                      <QuotationsFilterDropdown
                        filterPreset={filterPreset}
                        documentType={documentType}
                        dateField={dateField}
                        groupBy={groupBy}
                        activeTab={activeTab}
                        activeView={activeView}
                        deletedView={isDeletedInvoiceView || isDeletedQuotationView}
                        query={params.q || ""}
                        customFilter={params.customFilter || ""}
                        projectPreset={params.projectPreset || ""}
                        projectCategory={params.projectCategory || ""}
                        projectBudgetRanges={params.projectBudgetRanges || ""}
                        budgetMin={params.budgetMin || ""}
                        budgetMax={params.budgetMax || ""}
                        quotationStatus={params.quotationStatus || ""}
                        salespersonFilter={params.salespersonFilter || ""}
                        customerFilter={params.customerFilter || ""}
                        paymentMethodFilter={params.paymentMethodFilter || ""}
                        quotationDateRange={params.quotationDateRange || ""}
                        projectStatus={params.projectStatus || ""}
                        projectDateRange={params.projectDateRange || ""}
                        projectCategories={projectCategories}
                        quotationStatusOptions={quotationStatusOptions}
                        salespersonOptions={salespersonOptions}
                        customerOptions={customerOptions}
                        paymentMethodOptions={paymentMethodOptions}
                        projectStatusOptions={projectStatusOptions}
                        saveSearchHref={pageHref(1)}
                        clearAllHref={pageHref(1, {
                          clearFilters: true,
                          filterPreset: "all_quotations",
                          documentType: "quotations",
                          dateField: "create_date",
                          customFilter: "",
                          groupBy: "",
                          projectPreset: "",
                          projectCategory: "",
                          projectBudgetRanges: "",
                          budgetMin: "",
                          budgetMax: "",
                          quotationStatus: "",
                          salespersonFilter: "",
                          customerFilter: "",
                          paymentMethodFilter: "",
                          quotationDateRange: "",
                          projectStatus: "",
                          projectDateRange: "",
                          q: "",
                        })}
                        groupByLinks={[
                          { key: "status", label: "Status", href: pageHref(1, { groupBy: "status" }) },
                          { key: "salesperson", label: "Salesperson", href: pageHref(1, { groupBy: "salesperson" }) },
                          { key: "customer", label: "Customer", href: pageHref(1, { groupBy: "customer" }) },
                          { key: "order_date", label: "Order Date", href: pageHref(1, { groupBy: "order_date" }) },
                          { key: "payment_method", label: "Payment Method", href: pageHref(1, { groupBy: "payment_method" }) },
                        ]}
                      />
                    </div>
                  </OrdersToInvoiceSelectionToolbar>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end xl:flex-nowrap">
                <span className="whitespace-nowrap text-xs text-slate-700">
                  {uiRangeStart}-{uiRangeEnd} / {uiTotalItems}
                </span>

                <Link
                  href={pageHref(Math.max(1, uiCurrentPage - 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 ${
                    uiCurrentPage <= 1 ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
                <Link
                  href={pageHref(Math.min(uiTotalPages, uiCurrentPage + 1))}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 ${
                    uiCurrentPage >= uiTotalPages ? "pointer-events-none text-slate-300" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>

                <div className="shrink-0">
                  <SalesViewSwitcher activeView={currentViewMode} items={availableViews} />
                </div>
              </div>
            </>
          ) : (
            <Link href="/crm" className="text-sm font-medium text-slate-700 hover:text-slate-900 xl:justify-self-end">
              Back to CRM
            </Link>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-white">
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {isProjectsTab && (currentViewMode === "list" || currentViewMode === "table" || currentViewMode === "kanban") && (
          <div className="p-4">
            <CrmProjectTypesManager
              items={projectViewItems}
              defaultShowNew={params.newProject === "1"}
              showNewToggle={false}
              viewMode={currentViewMode === "kanban" ? "kanban" : currentViewMode === "table" ? "table" : "list"}
              groupBy={groupBy}
              projectCategoryValues={projectCategoryValues}
              projectBudgetRangeValues={projectBudgetRangeValues}
              hasBudgetLimits={Number.isFinite(budgetMin) || Number.isFinite(budgetMax)}
            />
          </div>
        )}

        {isProjectsTab && currentViewMode === "map" && (
          <div className="p-4">
            <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              Map view is grouped by project category because project geo-location is not available.
            </div>
            <div className="space-y-2">
              {Object.entries(projectCategoryBuckets).length === 0 ? (
                <p className="text-sm text-slate-500">No project data to display.</p>
              ) : (
                Object.entries(projectCategoryBuckets).map(([category, bucket]) => (
                  <div key={category} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{category}</p>
                    <p className="text-sm text-slate-600">
                      {bucket.count} project(s) - {currency.format(bucket.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isProjectsTab && currentViewMode === "calendar" && (
          <div className="space-y-3 p-4">
            {Object.entries(projectCalendarBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No projects yet</p>
            ) : (
              Object.entries(projectCalendarBuckets).map(([date, items]) => (
                <div key={date} className="rounded-md border border-slate-200">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{date}</div>
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{item.name}</span>
                        <span className="font-medium">{currency.format(item.budget)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isProjectsTab && currentViewMode === "chart" && (
          <div className="space-y-3 p-4">
            {Object.entries(projectCategoryBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No chart data</p>
            ) : (
              Object.entries(projectCategoryBuckets).map(([category, bucket]) => {
                const width = Math.max(8, Math.round((bucket.count / Math.max(projectViewItems.length, 1)) * 100));
                return (
                  <div key={category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{category}</span>
                      <span className="text-slate-600">{bucket.count}</span>
                    </div>
                    <div className="h-3 rounded bg-slate-100">
                      <div className="h-3 rounded bg-cyan-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {isProjectsTab && currentViewMode === "history" && (
          <div className="divide-y">
            {recentProjectHistory.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No history available.</p>
            ) : (
              recentProjectHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-slate-600">{item.category || "Other"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{currency.format(item.budget)}</p>
                    <p className="text-xs text-slate-500">{new Date(item.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isReportingTab && (
          <div className="space-y-6 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Quotation Value</p>
                  <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{currency.format(reportingTotalValue)}</p>
                <p className="mt-1 text-xs text-slate-500">{reportingRowCount} quotations in current filter</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Confirmed Orders</p>
                  <Trophy className="h-4 w-4 text-amber-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{confirmedRows.length}</p>
                <p className="mt-1 text-xs text-slate-500">{currency.format(confirmedValue)} won revenue</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Average Quotation</p>
                  <BarChart3 className="h-4 w-4 text-cyan-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{currency.format(averageQuotationValue)}</p>
                <p className="mt-1 text-xs text-slate-500">Useful for checking deal size quality</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-600">Conversion</p>
                  <Activity className="h-4 w-4 text-violet-600" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-slate-900">{conversionRate.toFixed(1)}%</p>
                <p className="mt-1 text-xs text-slate-500">
                  {draftRows.length} draft, {sentRows.length} sent
                </p>
              </div>
            </div>

            {(currentViewMode === "list" || currentViewMode === "table") && (
              <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                <div className="rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Pipeline by Status</p>
                      <p className="text-xs text-slate-500">Odoo-style sales stage health based on quotation status</p>
                    </div>
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="space-y-4 p-4">
                    {statusSummaryRows.length === 0 ? (
                      <p className="text-sm text-slate-500">No reporting data for the current filters.</p>
                    ) : (
                      statusSummaryRows.map((row) => (
                        <div key={row.status}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-800">{row.status}</span>
                            <span className="text-slate-600">
                              {row.count} docs - {currency.format(row.total)}
                            </span>
                          </div>
                          <div className="h-2.5 rounded-full bg-slate-100">
                            <div
                              className="h-2.5 rounded-full bg-cyan-600"
                              style={{ width: `${Math.max(6, Math.round(row.share))}%` }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Sales Snapshot</p>
                    <p className="text-xs text-slate-500">Quick checkpoints for the current pipeline</p>
                  </div>
                  <div className="space-y-3 p-4 text-sm">
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Draft Quotations</span>
                      <span className="font-semibold text-slate-900">{draftRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Sent Quotations</span>
                      <span className="font-semibold text-slate-900">{sentRows.length}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Confirmed Revenue</span>
                      <span className="font-semibold text-slate-900">{currency.format(confirmedValue)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                      <span className="text-slate-600">Open Pipeline</span>
                      <span className="font-semibold text-slate-900">
                        {currency.format(Math.max(reportingTotalValue - confirmedValue, 0))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Top Salespeople</p>
                    <p className="text-xs text-slate-500">Ranked by quotation value in the selected scope</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-slate-500">
                          <th className="px-4 py-3">Salesperson</th>
                          <th className="px-4 py-3">Quotations</th>
                          <th className="px-4 py-3">Confirmed</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-4 py-3">Last Activity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportingSalespeople.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              No salesperson data.
                            </td>
                          </tr>
                        ) : (
                          reportingSalespeople.slice(0, 8).map((row) => (
                            <tr key={row.name} className="border-b last:border-b-0 hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                              <td className="px-4 py-3 text-slate-600">{row.count}</td>
                              <td className="px-4 py-3 text-slate-600">{row.confirmed}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">{currency.format(row.total)}</td>
                              <td className="px-4 py-3 text-slate-600">
                                {row.lastDate ? new Date(row.lastDate).toLocaleDateString() : "-"}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Top Customers</p>
                    <p className="text-xs text-slate-500">Customers generating the highest quotation value</p>
                  </div>
                  <div className="space-y-3 p-4">
                    {reportingCustomers.length === 0 ? (
                      <p className="text-sm text-slate-500">No customer data.</p>
                    ) : (
                      reportingCustomers.slice(0, 6).map((customer) => (
                        <div key={customer.name} className="rounded-md border border-slate-200 px-3 py-3">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-slate-900">{customer.name}</p>
                              <p className="text-xs text-slate-500">{customer.count} quotations</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-slate-900">{currency.format(customer.total)}</p>
                              <p className="text-xs text-slate-500">
                                {customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentViewMode === "chart" && (
              <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Monthly Trend</p>
                    <p className="text-xs text-slate-500">Revenue and confirmed orders over the last visible months</p>
                  </div>
                  <div className="space-y-4 p-4">
                    {reportingMonthlyTrend.length === 0 ? (
                      <p className="text-sm text-slate-500">No monthly trend available.</p>
                    ) : (
                      reportingMonthlyTrend.map((month) => {
                        const width = reportingTotalValue > 0 ? (month.total / reportingTotalValue) * 100 : 0;
                        return (
                          <div key={month.key}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-900">{month.label}</span>
                              <span className="text-slate-600">
                                {currency.format(month.total)} - {month.confirmed} confirmed
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-slate-100">
                              <div
                                className="h-3 rounded-full bg-emerald-500"
                                style={{ width: `${Math.max(8, Math.round(width))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200">
                  <div className="border-b bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Status Mix</p>
                    <p className="text-xs text-slate-500">Distribution of documents inside the current reporting scope</p>
                  </div>
                  <div className="space-y-4 p-4">
                    {statusSummaryRows.length === 0 ? (
                      <p className="text-sm text-slate-500">No status data.</p>
                    ) : (
                      statusSummaryRows.map((row) => (
                        <div key={row.status} className="rounded-md border border-slate-200 px-3 py-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900">{row.status}</p>
                            <span className="text-sm text-slate-600">{row.share.toFixed(1)}%</span>
                          </div>
                          <p className="mt-1 text-sm text-slate-600">
                            {row.count} quotations - {currency.format(row.total)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentViewMode === "table" && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-slate-500">
                      <th className="px-4 py-3">Quotation</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Salesperson</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportingRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                          No quotations match the current reporting filters.
                        </td>
                      </tr>
                    ) : (
                      reportingRows.slice(0, 20).map((quotation) => (
                        <tr key={quotation.id} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">{quotation.quotationNo}</td>
                          <td className="px-4 py-3 text-slate-600">{quotation.clientName}</td>
                          <td className="px-4 py-3 text-slate-600">{quotation.salespersonName || "Unassigned"}</td>
                          <td className="px-4 py-3">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                              {quotation.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {currency.format(Number(quotation.totalAmount || 0))}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(quotation.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {currentViewMode === "history" && (
              <div className="rounded-lg border border-slate-200">
                <div className="border-b bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Recent Sales Activity</p>
                  <p className="text-xs text-slate-500">Latest quotations and their current stage</p>
                </div>
                <div className="divide-y">
                  {reportingRecentRows.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No recent activity.</p>
                  ) : (
                    reportingRecentRows.map((quotation) => (
                      <div key={quotation.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{quotation.quotationNo} · {quotation.title}</p>
                          <p className="text-slate-600">
                            {quotation.clientName} · {quotation.salespersonName || "Unassigned"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="inline-flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            <Send className="h-3 w-3" />
                            {quotation.status}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(quotation.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isInvoiceListTab && !isDeletedInvoiceView && (currentViewMode === "list" || currentViewMode === "table") && (
          <OrdersToInvoiceTable
            rows={pagedToInvoiceRowsView}
            emptyLabel="Invoices"
            selectionEnabled={canManageInvoiceRows}
            returnHref={currentPageHref}
            canDelete={canManageInvoiceRows}
          />
        )}

        {isOrdersToInvoiceTab && (currentViewMode === "list" || currentViewMode === "table") && (
          <OrdersAwaitingInvoiceTable rows={pagedOrdersToInvoiceRows} returnHref={currentPageHref} />
        )}

        {isUpsellTab && (currentViewMode === "list" || currentViewMode === "table") && (
          <OrdersToUpsellTable rows={pagedUpsellRows} />
        )}

        {isInvoiceListTab && !isDeletedInvoiceView && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedToInvoiceRowsView.length === 0 ? (
              <p className="text-sm text-slate-500">No invoices available.</p>
            ) : (
              pagedToInvoiceRowsView.map((row) => (
                <Link
                  key={row.invoiceId}
                  href={withInternalBackHref(`/crm/${row.crmLeadId}/quotations/${row.quotationId}/invoice`, currentPageHref)}
                  className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{row.invoiceRef}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{row.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{row.clientName}</p>
                  <p className="text-xs text-slate-500">{row.salespersonName || "-"}</p>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{row.totalLabel}</p>
                </Link>
              ))
            )}
          </div>
        )}

        {isOrdersToInvoiceTab && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedOrdersToInvoiceRows.length === 0 ? (
              <p className="text-sm text-slate-500">No confirmed sales orders are waiting for invoice generation.</p>
            ) : (
              pagedOrdersToInvoiceRows.map((row) => (
                <div key={row.quotationId} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={withInternalBackHref(row.viewOrderHref, currentPageHref)}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {row.orderId}
                    </Link>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{row.invoiceStatus}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{row.customerName}</p>
                  <p className="text-sm text-slate-700">{row.product}</p>
                  <p className="mt-3 text-sm text-slate-600">{row.orderDateLabel}</p>
                  <p className="text-sm font-semibold text-slate-900">{row.totalLabel}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={withInternalBackHref(row.generateInvoiceHref, currentPageHref)}
                      className="rounded-md bg-[#7c5a77] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d4f69]"
                    >
                      Generate Invoice
                    </Link>
                    <Link
                      href={withInternalBackHref(row.sendInvoiceHref, currentPageHref)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Send Invoice
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isUpsellTab && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedUpsellRows.length === 0 ? (
              <p className="text-sm text-slate-500">No completed purchases are currently ready for upsell follow-up.</p>
            ) : (
              pagedUpsellRows.map((row) => (
                <div key={row.quotationId} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={row.opportunityHref} className="font-semibold text-slate-900 hover:underline">
                      {row.customerName}
                    </Link>
                    <span className="rounded bg-cyan-50 px-2 py-0.5 text-xs text-cyan-700">{row.opportunityStatus}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">Previous: {row.previousProductPurchased}</p>
                  <p className="text-sm font-medium text-slate-900">Suggested: {row.suggestedUpgradeProduct}</p>
                  <p className="mt-3 text-xs text-slate-500">{row.salesperson}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={row.opportunityHref} className="rounded-md bg-[#7c5a77] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6d4f69]">
                      Create Opportunity
                    </Link>
                    {row.contactHref ? (
                      <a href={row.contactHref} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        Contact Customer
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isDeletedInvoiceView && (currentViewMode === "list" || currentViewMode === "table") && (
          <div className="p-6">
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3">Order No</th>
                    <th className="p-3">Client Name</th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeletedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-500">
                        No deleted invoices
                      </td>
                    </tr>
                  ) : (
                    filteredDeletedRows.map((row) => (
                      <tr key={row.invoiceId} className="border-b last:border-b-0">
                        <td className="p-3 font-medium">{row.invoiceRef}</td>
                        <td className="p-3">{row.orderNo}</td>
                        <td className="p-3">{row.clientName}</td>
                        <td className="p-3">{row.salespersonName || "-"}</td>
                        <td className="p-3">{row.status}</td>
                        <td className="p-3">{new Date(row.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isDeletedInvoiceView && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDeletedRows.length === 0 ? (
              <p className="text-sm text-slate-500">No deleted invoices.</p>
            ) : (
              filteredDeletedRows.map((row) => (
                <div key={row.invoiceId} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{row.invoiceRef}</p>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{row.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{row.clientName}</p>
                  <p className="text-xs text-slate-500">{row.salespersonName || "-"}</p>
                  <p className="mt-3 text-xs text-slate-500">{new Date(row.createdAt).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        )}

        {selectedOrderTab === "sales-teams" && (currentViewMode === "list" || currentViewMode === "table") && (
          <SalesSummaryListTable
            rows={salesTeamRows}
            firstColumnLabel="Sales Team"
            emptyText="No sales team data"
            canDelete={canDeleteSales}
          />
        )}

        {selectedOrderTab === "sales-teams" && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSalesTeamDetails.length === 0 ? (
              <p className="text-sm text-slate-500">No sales team data</p>
            ) : (
              sortedSalesTeamDetails.map((team) => (
                <Link
                  key={team.name}
                  href={pageHref(1, { tab: "orders", q: team.name })}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold text-slate-900">{team.name}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Quotations</span>
                      <span className="font-medium text-slate-900">{team.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Value</span>
                      <span className="font-medium text-slate-900">{currency.format(team.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last Activity</span>
                      <span className="font-medium text-slate-900">
                        {team.lastDate ? new Date(team.lastDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {selectedOrderTab === "customers" && (currentViewMode === "list" || currentViewMode === "table") && (
          <SalesSummaryListTable
            rows={customerRows}
            firstColumnLabel="Customer"
            emptyText="No customer data"
            canDelete={canDeleteSales}
          />
        )}

        {selectedOrderTab === "customers" && currentViewMode === "kanban" && (
          <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedCustomerDetails.length === 0 ? (
              <p className="text-sm text-slate-500">No customer data</p>
            ) : (
              sortedCustomerDetails.map((customer) => (
                <Link
                  key={customer.name}
                  href={pageHref(1, { tab: "orders", q: customer.name })}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-lg font-semibold text-slate-900">{customer.name}</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Quotations</span>
                      <span className="font-medium text-slate-900">{customer.count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Total Value</span>
                      <span className="font-medium text-slate-900">{currency.format(customer.total)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Last Quotation</span>
                      <span className="font-medium text-slate-900">
                        {customer.lastDate ? new Date(customer.lastDate).toLocaleDateString() : "-"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {isDeletedQuotationView && (currentViewMode === "list" || currentViewMode === "table") && (
          <div className="p-6">
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left">
                    <th className="p-3">{salesDocumentNumberLabel}</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Client</th>
                    <th className="p-3">Salesperson</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Deleted</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedQuotationListRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-500">
                        {`No deleted ${salesDocumentPluralLabelLower}`}
                      </td>
                    </tr>
                  ) : (
                    deletedQuotationListRows.map((row) => (
                      <tr key={row.id} className="border-b last:border-b-0 hover:bg-slate-50">
                        <td className="p-3 font-medium">
                          <Link href={row.href} className="block hover:underline">
                            {row.quotationNo}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.title}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.clientName}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.salespersonName || "-"}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.status}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.totalLabel}
                          </Link>
                        </td>
                        <td className="p-3">
                          <Link href={row.href} className="block">
                            {row.deletedLabel}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isQuotationLikeTab && !isDeletedQuotationView && (currentViewMode === "list" || currentViewMode === "table") && (
          <QuotationsOrdersListTable
            rows={quotationListRows}
            emptyLabel={selectedOrderLabel}
            documentLabel={salesDocumentLabel}
            documentLabelPlural={salesDocumentPluralLabel}
            numberColumnLabel={salesDocumentNumberLabel}
            returnHref={currentPageHref}
            canDelete={canDeleteSales}
          />
        )}

        {isQuotationLikeTab && currentViewMode === "kanban" && (
          <div className="p-4">
            {pagedQuotations.length === 0 ? (
              <p className="text-sm text-slate-500">{`No ${salesDocumentPluralLabelLower} yet`}</p>
            ) : groupBy === "salesperson" && groupedQuotationKanbanColumns.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-2 sm:gap-5">
                {groupedQuotationKanbanColumns.map((column) => (
                  <div
                    key={column.key}
                    className="w-[252px] min-w-[252px] max-w-[252px] overflow-hidden border border-slate-300 bg-white sm:w-[312px] sm:min-w-[312px] sm:max-w-[312px]"
                  >
                    <div className="border-b border-slate-300 bg-cyan-50 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold leading-tight text-slate-950">{column.label}</p>
                          <p className="mt-1 text-sm text-slate-600">{column.count}</p>
                        </div>
                        <p className="text-[15px] font-semibold leading-tight text-slate-900">{currency.format(column.total)}</p>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {column.quotations.map((quotation) => (
                        <Link
                          key={quotation.id}
                          href={withInternalBackHref(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`, currentPageHref)}
                          className="block bg-white px-3 py-3 transition hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[18px] font-semibold leading-tight text-slate-950">{quotation.quotationNo}</p>
                              <p className="mt-2 line-clamp-1 text-sm font-medium text-slate-800">{quotation.title}</p>
                            </div>
                            <span className="rounded bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                              {quotation.status}
                            </span>
                          </div>
                          <p className="mt-4 text-[22px] font-semibold leading-tight text-slate-950">
                            {currency.format(Number(quotation.totalAmount || 0))}
                          </p>
                          <p className="mt-2 text-sm text-slate-600">{quotation.clientName || "-"}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagedQuotations.map((quotation) => (
                  <Link
                    key={quotation.id}
                    href={withInternalBackHref(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`, currentPageHref)}
                    className="rounded-lg border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{quotation.quotationNo}</p>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{quotation.status}</span>
                    </div>
                    <p className="mt-2 line-clamp-1 text-sm text-slate-700">{quotation.title}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{quotation.clientName}</p>
                    <p className="text-xs text-slate-500">{quotation.salespersonName || "-"}</p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{currency.format(Number(quotation.totalAmount || 0))}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "map" && (
          <div className="p-4">
            <div className="mb-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
              {`Map view is grouped by customer because ${salesDocumentLabelLower} addresses are not available in current data.`}
            </div>
            <div className="space-y-2">
              {Object.values(customerBuckets).length === 0 ? (
                <p className="text-sm text-slate-500">No customer data to display.</p>
              ) : (
                Object.values(customerBuckets).map((bucket) => (
                  <div key={bucket.client} className="rounded-md border border-slate-200 p-3">
                    <p className="font-medium text-slate-900">{bucket.client}</p>
                    <p className="text-sm text-slate-600">
                      {bucket.count} {bucket.count === 1 ? salesDocumentLabelLower : salesDocumentPluralLabelLower} - {currency.format(bucket.total)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "calendar" && (
          <div className="space-y-3 p-4">
            {Object.entries(calendarBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">{`No ${salesDocumentPluralLabelLower} yet`}</p>
            ) : (
              Object.entries(calendarBuckets).map(([date, items]) => (
                <div key={date} className="rounded-md border border-slate-200">
                  <div className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800">{date}</div>
                  <div className="divide-y">
                    {items.map((quotation) => (
                      <Link
                        key={quotation.id}
                        href={withInternalBackHref(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`, currentPageHref)}
                        className="flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span>{quotation.quotationNo} - {quotation.clientName}</span>
                        <span className="font-medium">{currency.format(Number(quotation.totalAmount || 0))}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "chart" && (
          <div className="space-y-3 p-4">
            {Object.keys(statusBuckets).length === 0 ? (
              <p className="text-sm text-slate-500">No chart data</p>
            ) : (
              Object.entries(statusBuckets).map(([status, count]) => {
                const width = Math.max(8, Math.round((count / Math.max(totalItems, 1)) * 100));
                return (
                  <div key={status}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{status}</span>
                      <span className="text-slate-600">{count}</span>
                    </div>
                    <div className="h-3 rounded bg-slate-100">
                      <div className="h-3 rounded bg-cyan-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {isQuotationLikeTab && currentViewMode === "history" && (
          <div className="divide-y">
            {filteredQuotations.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No history available.</p>
            ) : (
              filteredQuotations.slice(0, 30).map((quotation) => (
                <Link
                  key={quotation.id}
                  href={withInternalBackHref(`/crm/${quotation.crmLeadId}/quotations/${quotation.id}`, currentPageHref)}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{quotation.quotationNo} - {quotation.title}</p>
                    <p className="text-slate-600">{quotation.clientName} - {quotation.salespersonName || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">{currency.format(Number(quotation.totalAmount || 0))}</p>
                    <p className="text-xs text-slate-500">{new Date(quotation.createdAt).toLocaleString()}</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
        </div>
      </div>
      </div>
    </Suspense>
  );
}


