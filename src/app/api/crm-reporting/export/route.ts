import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCrmReportingData, type CrmReportingFilters } from "@/lib/crm-reporting";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function buildSimplePdf(lines: string[]) {
  const safeLines = lines.slice(0, 60);
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 790 Td",
    ...safeLines.flatMap((line, index) => [
      `(${line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")}) Tj`,
      index === safeLines.length - 1 ? "" : "0 -14 Td",
    ]),
    "ET",
  ]
    .filter(Boolean)
    .join("\n");

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function escape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function buildCsv(section: ReturnType<typeof getSectionRows>, title: string) {
  const headers = Object.keys(section.rows[0] || {});
  const head = headers.join(",");
  const body = section.rows.map((row) => headers.map((header) => escape(String(row[header as keyof typeof row] ?? ""))).join(","));
  return [title, head, ...body].join("\n");
}

function buildExcel(section: ReturnType<typeof getSectionRows>, title: string) {
  const headers = Object.keys(section.rows[0] || {});
  const thead = headers.map((header) => `<th>${header}</th>`).join("");
  const tbody = section.rows
    .map((row) => `<tr>${headers.map((header) => `<td>${String(row[header as keyof typeof row] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><table border="1"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></body></html>`;
}

function buildPrintHtml(section: ReturnType<typeof getSectionRows>, title: string) {
  const headers = Object.keys(section.rows[0] || {});
  const thead = headers.map((header) => `<th>${header}</th>`).join("");
  const tbody = section.rows
    .map((row) => `<tr>${headers.map((header) => `<td>${String(row[header as keyof typeof row] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f4f4f5}</style></head><body><h1>${title}</h1><table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table><script>window.print()</script></body></html>`;
}

function getSectionRows(report: Awaited<ReturnType<typeof getCrmReportingData>>) {
  if (report.filters.section === "crm") {
    return {
      title: "CRM Reporting",
      rows: report.crm.detailRows.map((row) => ({
        title: row.title,
        customer: row.customer,
        stage: row.stage,
        salesperson: row.salesperson,
        campaign: row.campaign,
        source: row.source,
        value: formatCurrency(row.value),
        createdAt: new Date(row.createdAt).toLocaleDateString(),
      })),
    };
  }
  if (report.filters.section === "quotations") {
    return {
      title: "Quotation Reporting",
      rows: report.quotations.detailRows.map((row) => ({
        quotationNo: row.quotationNo,
        title: row.title,
        customer: row.customer,
        salesperson: row.salesperson,
        status: row.status,
        amount: formatCurrency(row.amount),
        createdAt: new Date(row.createdAt).toLocaleDateString(),
      })),
    };
  }
  if (report.filters.section === "invoices") {
    return {
      title: "Invoice Reporting",
      rows: report.invoices.detailRows.map((row) => ({
        invoiceRef: row.invoiceRef,
        customer: row.customer,
        salesperson: row.salesperson,
        status: row.status,
        paidAmount: formatCurrency(row.paidAmount),
        balanceAmount: formatCurrency(row.balanceAmount),
        totalAmount: formatCurrency(row.totalAmount),
        createdAt: new Date(row.createdAt).toLocaleDateString(),
      })),
    };
  }

  return {
    title: "Overview Reporting",
    rows: [
      {
        totalLeads: String(report.overview.totalLeads),
        totalQuotations: String(report.overview.totalQuotations),
        totalConfirmedOrders: String(report.overview.totalConfirmedOrders),
        totalRevenue: formatCurrency(report.overview.totalRevenue),
        conversionRate: `${report.overview.conversionRate.toFixed(1)}%`,
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const format = (searchParams.get("format") || "csv") as "csv" | "excel" | "pdf" | "print";
  const filters: CrmReportingFilters = {
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    salesperson: searchParams.get("salesperson") || undefined,
    customer: searchParams.get("customer") || undefined,
    status: searchParams.get("status") || undefined,
    product: searchParams.get("product") || undefined,
    campaign: searchParams.get("campaign") || undefined,
    company: searchParams.get("company") || undefined,
    groupBy: (searchParams.get("groupBy") as "stage" | "month" | "user" | null) || undefined,
    section: (searchParams.get("section") as "overview" | "crm" | "quotations" | "invoices" | null) || undefined,
  };

  const report = await getCrmReportingData(filters, {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });
  const section = getSectionRows(report);
  const slug = `${section.title.toLowerCase().replace(/\s+/g, "-")}-${report.filters.startDate}`;

  if (format === "excel") {
    return new NextResponse(buildExcel(section, section.title), {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}.xls"`,
      },
    });
  }

  if (format === "pdf") {
    const lines = [
      section.title,
      `Date Range: ${report.filters.startDate} to ${report.filters.endDate}`,
      "",
      ...section.rows.slice(0, 30).map((row) => Object.values(row).join(" | ")),
    ];
    return new NextResponse(buildSimplePdf(lines), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}.pdf"`,
      },
    });
  }

  if (format === "print") {
    return new NextResponse(buildPrintHtml(section, section.title), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new NextResponse(buildCsv(section, section.title), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.csv"`,
    },
  });
}
