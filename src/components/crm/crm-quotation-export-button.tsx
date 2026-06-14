"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QuotationExportItem {
  name: string;
  unitCount: number;
  amount: number;
  gstPercent: number;
  tags?: string | null;
}

interface CrmQuotationExportButtonProps {
  quotationNo: string;
  title: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  validUntil: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  projectTitle: string;
  serviceName: string | null;
  unitName: string | null;
  unitCount: number;
  unitPrice: number;
  gstPercent: number;
  subtotalAmount: number;
  gstAmount: number;
  totalAmount: number;
  terms: string | null;
  notes: string | null;
  items: QuotationExportItem[];
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function CrmQuotationExportButton(props: CrmQuotationExportButtonProps) {
  const onExport = () => {
    const rows =
      props.items.length > 0
        ? props.items
            .map((item, index) => {
              const qty = Math.max(1, item.unitCount || 1);
              const unitPrice = item.amount / qty;
              const taxAmount = item.amount * (item.gstPercent / 100);
              const lineTotal = item.amount + taxAmount;
              return `
                <tr>
                  <td class="num">${index + 1}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(props.unitName || "Unit")}</td>
                  <td class="num">${item.unitCount}</td>
                  <td class="num">${unitPrice.toFixed(2)}</td>
                  <td class="num">${item.amount.toFixed(2)}</td>
                  <td class="num">${item.gstPercent.toFixed(2)}%</td>
                  <td class="num">${taxAmount.toFixed(2)}</td>
                  <td class="num">${lineTotal.toFixed(2)}</td>
                </tr>
                ${
                  item.tags
                    ? `<tr><td></td><td colspan="8" style="font-size:11px;color:#6b7280;">Tags: ${escapeHtml(item.tags)}</td></tr>`
                    : ""
                }
              `;
            })
            .join("")
        : `
            <tr>
              <td class="num">1</td>
              <td>${escapeHtml(props.serviceName || props.projectTitle)}</td>
              <td>${escapeHtml(props.unitName || "Unit")}</td>
              <td class="num">${props.unitCount}</td>
              <td class="num">${props.unitPrice.toFixed(2)}</td>
              <td class="num">${props.subtotalAmount.toFixed(2)}</td>
              <td class="num">${props.gstPercent.toFixed(2)}%</td>
              <td class="num">${props.gstAmount.toFixed(2)}</td>
              <td class="num">${props.totalAmount.toFixed(2)}</td>
            </tr>
          `;

    const validUntilText = props.validUntil ? new Date(props.validUntil).toLocaleDateString() : "-";
    const createdAtText = new Date(props.createdAt).toLocaleDateString();
    const sentAtText = props.sentAt ? new Date(props.sentAt).toLocaleString() : "Not sent";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Quotation ${escapeHtml(props.quotationNo)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
      .sheet { width: 178mm; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
      .title { font-size: 26px; font-weight: 700; letter-spacing: 0.02em; margin: 0; text-transform: uppercase; }
      .sub { color: #4b5563; margin: 4px 0 0; font-size: 12px; }
      .company { font-weight: 700; font-size: 18px; margin-bottom: 4px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 12px; }
      .label { color: #6b7280; font-size: 12px; margin-bottom: 2px; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 7px 8px; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; text-transform: uppercase; }
      .num { text-align: right; }
      .totals { width: 360px; margin-left: auto; margin-top: 12px; }
      .totals .line { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
      .totals .line.total { font-size: 16px; font-weight: 700; border-bottom: 0; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
      .meta .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #d1d5db; padding: 4px 0; }
      .meta .row span:first-child { color: #6b7280; }
      @media print {
        .sheet { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <div class="company">Your Company</div>
          <h1 class="title">Quotation</h1>
          <p class="sub">${escapeHtml(props.title)}</p>
        </div>
        <div style="text-align:right;">
          <div class="label">Quotation No</div>
          <div class="value">${escapeHtml(props.quotationNo)}</div>
          <div class="label" style="margin-top:8px;">Date</div>
          <div>${createdAtText}</div>
        </div>
      </div>

      <div class="grid">
        <div>
          <div class="card">
            <div class="label">Customer</div>
            <div class="value">${escapeHtml(props.clientName)}</div>
            <div>${escapeHtml(props.clientEmail)}</div>
            <div>${escapeHtml(props.clientPhone || "-")}</div>
          </div>
        </div>
        <div>
          <div class="card">
            <div class="label">Quotation Information</div>
            <div class="meta">
              <div>
                <div class="row"><span>Quotation No</span><strong>${escapeHtml(props.quotationNo)}</strong></div>
                <div class="row"><span>Quotation Date</span><span>${createdAtText}</span></div>
                <div class="row"><span>Expiration</span><span>${validUntilText}</span></div>
                <div class="row"><span>Status</span><span>${escapeHtml(props.status)}</span></div>
              </div>
              <div>
                <div class="row"><span>Project</span><span>${escapeHtml(props.projectTitle)}</span></div>
                <div class="row"><span>Service</span><span>${escapeHtml(props.serviceName || "-")}</span></div>
                <div class="row"><span>Unit Label</span><span>${escapeHtml(props.unitName || "Unit")}</span></div>
                <div class="row"><span>Sent At</span><span>${escapeHtml(sentAtText)}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Description</th>
            <th>Unit</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">Subtotal</th>
            <th class="num">Tax %</th>
            <th class="num">Tax Amt</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Subtotal</span><strong>${props.subtotalAmount.toFixed(2)}</strong></div>
        <div class="line"><span>Tax (GST)</span><strong>${props.gstAmount.toFixed(2)}</strong></div>
        <div class="line total"><span>Total</span><span>${props.totalAmount.toFixed(2)}</span></div>
      </div>

    </div>
  </body>
</html>`;

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);

    const cleanup = () => {
      setTimeout(() => {
        if (document.body.contains(frame)) {
          document.body.removeChild(frame);
        }
      }, 1500);
    };

    frame.onload = () => {
      const printTarget = frame.contentWindow;
      if (!printTarget) {
        cleanup();
        toast.error("Could not open download dialog.");
        return;
      }
      printTarget.focus();
      printTarget.print();
      cleanup();
    };

    const doc = frame.contentDocument;
    if (!doc) {
      cleanup();
      toast.error("Could not prepare quotation document.");
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
  };

  return (
    <Button onClick={onExport} variant="outline">
      Download PDF
    </Button>
  );
}
