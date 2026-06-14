import Link from "next/link";
import {
  BarChart3,
  CircleDollarSign,
  FileDown,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreHorizontal,
  PieChart,
  Printer,
  Users,
} from "lucide-react";
import type { CrmReportingData } from "@/lib/crm-reporting";
import {
  ReportingBarChart,
  ReportingLineChart,
  ReportingPieChart,
} from "@/components/crm/reporting/reporting-charts";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type ReportingSectionKey = "overview" | "crm" | "quotations" | "invoices";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

export function CrmReportingContent({
  report,
  basePath,
  exportBasePath,
  includeTabField = false,
  showFilters = true,
  visibleSections = ["overview", "crm", "quotations", "invoices"],
  title = "Business Reporting",
  description = "Odoo-style CRM, quotation, invoice, and analytics reporting with drill-down and exports.",
}: {
  report: CrmReportingData;
  basePath: string;
  exportBasePath: string;
  includeTabField?: boolean;
  showFilters?: boolean;
  visibleSections?: ReportingSectionKey[];
  title?: string;
  description?: string;
}) {
  const sectionItems: Array<{ key: ReportingSectionKey; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "crm", label: "CRM" },
    { key: "quotations", label: "Quotations" },
    { key: "invoices", label: "Invoices" },
  ];
  const availableSections = sectionItems.filter((item) => visibleSections.includes(item.key));

  const filtersToQuery = (overrides: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    const values = {
      startDate: report.filters.startDate,
      endDate: report.filters.endDate,
      salesperson: report.filters.salesperson,
      customer: report.filters.customer,
      status: report.filters.status,
      product: report.filters.product,
      campaign: report.filters.campaign,
      company: report.filters.company,
      groupBy: report.filters.groupBy,
      section: report.filters.section,
      ...overrides,
    };

    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });

    const query = next.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const exportHref = (format: "csv" | "excel" | "pdf" | "print") => {
    const next = new URLSearchParams({
      startDate: report.filters.startDate,
      endDate: report.filters.endDate,
      salesperson: report.filters.salesperson,
      customer: report.filters.customer,
      status: report.filters.status,
      product: report.filters.product,
      campaign: report.filters.campaign,
      company: report.filters.company,
      groupBy: report.filters.groupBy,
      section: report.filters.section,
      format,
    });
    return `${exportBasePath}?${next.toString()}`;
  };

  const activeSection = availableSections.some((item) => item.key === report.filters.section)
    ? report.filters.section
    : (availableSections[0]?.key ?? "overview");

  return (
    <div className="rounded-xl border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open export actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem asChild>
              <Link href={exportHref("csv")} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                CSV
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={exportHref("excel")} className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={exportHref("pdf")} className="flex items-center gap-2">
                <FileDown className="h-4 w-4" />
                PDF
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={exportHref("print")} target="_blank" className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {showFilters ? (
        <form className="grid gap-3 border-b bg-slate-50 px-4 py-4 md:grid-cols-3 xl:grid-cols-5">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Start Date</span>
            <input type="date" name="startDate" defaultValue={report.filters.startDate} className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">End Date</span>
            <input type="date" name="endDate" defaultValue={report.filters.endDate} className="w-full rounded-md border px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Salesperson</span>
            <select name="salesperson" defaultValue={report.filters.salesperson} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.salespeople.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Customer</span>
            <select name="customer" defaultValue={report.filters.customer} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.customers.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select name="status" defaultValue={report.filters.status} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.statuses.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Product</span>
            <select name="product" defaultValue={report.filters.product} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.products.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Campaign</span>
            <select name="campaign" defaultValue={report.filters.campaign} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.campaigns.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Company</span>
            <select name="company" defaultValue={report.filters.company} className="w-full rounded-md border px-3 py-2">
              <option value="">All</option>
              {report.options.companies.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Group By</span>
            <select name="groupBy" defaultValue={report.filters.groupBy} className="w-full rounded-md border px-3 py-2">
              <option value="month">Month</option>
              <option value="stage">Stage</option>
              <option value="user">User</option>
            </select>
          </label>
          <input type="hidden" name="section" value={activeSection} />
          {includeTabField ? <input type="hidden" name="tab" value="reporting" /> : null}
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-[#44a2de] px-4 py-2 text-sm font-medium text-white hover:bg-[#3991ca]">
              <Filter className="h-4 w-4" />
              Apply Filters
            </button>
            <Link href={`${basePath}?section=${activeSection}${includeTabField ? "&tab=reporting" : ""}`} className="rounded-md border px-4 py-2 text-sm text-slate-700 hover:bg-white">
              Reset
            </Link>
          </div>
        </form>
      ) : null}

      {availableSections.length > 1 ? (
        <div className="flex flex-wrap gap-2 border-b px-4 py-3">
          {availableSections.map((item) => (
            <Link
              key={item.key}
              href={filtersToQuery({ section: item.key })}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeSection === item.key ? "bg-[#44a2de] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Total Leads</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{report.overview.totalLeads}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Quotations</span>
            <FileText className="h-4 w-4 text-cyan-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{report.overview.totalQuotations}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Confirmed Orders</span>
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{report.overview.totalConfirmedOrders}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Revenue</span>
            <CircleDollarSign className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatCurrency(report.overview.totalRevenue)}</p>
        </div>
        <div className="rounded-xl border bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Conversion</span>
            <PieChart className="h-4 w-4 text-violet-600" />
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{report.overview.conversionRate.toFixed(1)}%</p>
        </div>
      </div>

      <div className="space-y-6 p-4 pt-0">
        {activeSection === "overview" && (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingLineChart title="Monthly Sales" data={report.overview.monthlySales} valueLabel="Revenue" />
              <ReportingPieChart title="Quotations by Status" data={report.overview.quotationsByStatus} valueLabel="Quotations" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingBarChart title="Lead Pipeline by Stage" data={report.overview.leadsByStage} valueLabel="Leads" />
              <div className="rounded-xl border bg-white">
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold text-slate-900">Top Customers by Revenue</h2>
                </div>
                <div className="divide-y">
                  {report.overview.topCustomers.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">No customer revenue data.</p>
                  ) : (
                    report.overview.topCustomers.map((item) => (
                      <Link key={item.label} href={item.href} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <div>
                          <p className="font-medium text-slate-900">{item.label}</p>
                          <p className="text-xs text-slate-500">{item.secondary}</p>
                        </div>
                        <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {activeSection === "crm" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Total Leads" value={String(report.crm.totalLeads)} />
              <MetricCard label="Qualified Leads" value={String(report.crm.qualifiedLeads)} />
              <MetricCard label="Won Deals" value={String(report.crm.wonDeals)} />
              <MetricCard label="Lost Deals" value={String(report.crm.lostDeals)} />
              <MetricCard label="Conversion Rate" value={`${report.crm.conversionRate.toFixed(1)}%`} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingBarChart title="Leads by Stage" data={report.crm.leadsByStage} valueLabel="Leads" />
              <ReportingPieChart title="Leads by Source" data={report.crm.leadsBySource} valueLabel="Leads" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingBarChart title="Leads by Salesperson" data={report.crm.leadsBySalesperson} valueLabel="Leads" />
              <ReportingLineChart title="Monthly Lead Trend" data={report.crm.monthlyLeadTrend} valueLabel="Leads" />
            </div>
            <LeadTable rows={report.crm.detailRows} />
          </>
        )}

        {activeSection === "quotations" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <MetricCard label="Total" value={String(report.quotations.total)} />
              <MetricCard label="Draft" value={String(report.quotations.draft)} />
              <MetricCard label="Sent" value={String(report.quotations.sent)} />
              <MetricCard label="Confirmed" value={String(report.quotations.confirmed)} />
              <MetricCard label="Rejected" value={String(report.quotations.rejected)} />
              <MetricCard label="Average Value" value={formatCurrency(report.quotations.averageValue)} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingLineChart title="Quotations by Month" data={report.quotations.byMonth} valueLabel="Amount" />
              <ReportingBarChart title="Quotations by Salesperson" data={report.quotations.bySalesperson} valueLabel="Amount" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingPieChart title="Quotations by Customer" data={report.quotations.byCustomer} valueLabel="Amount" />
              <QuotationTable rows={report.quotations.detailRows} />
            </div>
          </>
        )}

        {activeSection === "invoices" && (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Total Invoices" value={String(report.invoices.total)} />
              <MetricCard label="Paid" value={String(report.invoices.paid)} />
              <MetricCard label="Unpaid" value={String(report.invoices.unpaid)} />
              <MetricCard label="Overdue" value={String(report.invoices.overdue)} />
              <MetricCard label="Total Revenue" value={formatCurrency(report.invoices.totalRevenue)} />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <ReportingLineChart title="Revenue by Month" data={report.invoices.revenueByMonth} valueLabel="Revenue" />
              <ReportingPieChart title="Paid vs Unpaid" data={report.invoices.paidVsUnpaid} valueLabel="Invoices" />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-xl border bg-white">
                <div className="border-b px-4 py-3">
                  <h2 className="font-semibold text-slate-900">Top Customers by Revenue</h2>
                </div>
                <div className="divide-y">
                  {report.invoices.topCustomers.map((item) => (
                    <Link key={item.label} href={item.href} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <div>
                        <p className="font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.secondary}</p>
                      </div>
                      <span className="font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <InvoiceTable rows={report.invoices.detailRows} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LeadTable({
  rows,
}: {
  rows: Array<{
    id: string;
    title: string;
    customer: string;
    stage: string;
    salesperson: string;
    campaign: string;
    source: string;
    value: number;
    createdAt: Date;
    href: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">Lead</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Stage</th>
            <th className="px-4 py-3">Salesperson</th>
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Value</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No leads found.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900"><Link href={row.href}>{row.title}</Link></td>
              <td className="px-4 py-3">{row.customer}</td>
              <td className="px-4 py-3">{row.stage}</td>
              <td className="px-4 py-3">{row.salesperson}</td>
              <td className="px-4 py-3">{row.campaign}</td>
              <td className="px-4 py-3">{row.source}</td>
              <td className="px-4 py-3">{formatCurrency(row.value)}</td>
              <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuotationTable({
  rows,
}: {
  rows: Array<{
    id: string;
    quotationNo: string;
    title: string;
    customer: string;
    salesperson: string;
    status: string;
    amount: number;
    createdAt: Date;
    href: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">Quotation</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Salesperson</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No quotations found.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900"><Link href={row.href}>{row.quotationNo}</Link></td>
              <td className="px-4 py-3">{row.title}</td>
              <td className="px-4 py-3">{row.customer}</td>
              <td className="px-4 py-3">{row.salesperson}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
              <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceTable({
  rows,
}: {
  rows: Array<{
    id: string;
    invoiceRef: string;
    customer: string;
    salesperson: string;
    status: string;
    paidAmount: number;
    balanceAmount: number;
    totalAmount: number;
    createdAt: Date;
    href: string;
  }>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Salesperson</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Paid</th>
            <th className="px-4 py-3">Balance</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No invoices found.</td></tr>
          ) : rows.map((row) => (
            <tr key={row.id} className="border-t hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900"><Link href={row.href}>{row.invoiceRef}</Link></td>
              <td className="px-4 py-3">{row.customer}</td>
              <td className="px-4 py-3">{row.salesperson}</td>
              <td className="px-4 py-3">{row.status}</td>
              <td className="px-4 py-3">{formatCurrency(row.paidAmount)}</td>
              <td className="px-4 py-3">{formatCurrency(row.balanceAmount)}</td>
              <td className="px-4 py-3">{formatCurrency(row.totalAmount)}</td>
              <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
