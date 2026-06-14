"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CrmInvoiceExportButtonProps {
  invoiceNumber: string;
  quotationNo: string;
  invoiceDate: string;
  dueDate: string | null;
  paymentType: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectTitle: string;
  productName: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  subtotalAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function CrmInvoiceExportButton(props: CrmInvoiceExportButtonProps) {
  const onExport = () => {
    const invoiceDateText = new Date(props.invoiceDate).toLocaleDateString();
    const dueDateText = props.dueDate ? new Date(props.dueDate).toLocaleDateString() : "-";

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${escapeHtml(props.invoiceNumber)}</title>
    <style>
      @page { size: A4; margin: 16mm; }
      * { box-sizing: border-box; }
      body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
      .sheet { width: 178mm; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; border-bottom: 2px solid #1f2937; padding-bottom: 10px; }
      .title { font-size: 26px; font-weight: 700; margin: 0; text-transform: uppercase; }
      .sub { color: #4b5563; margin: 4px 0 0; font-size: 12px; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .label { color: #6b7280; font-size: 12px; margin-bottom: 2px; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 600; }
      .meta .row { display: flex; justify-content: space-between; border-bottom: 1px dashed #d1d5db; padding: 4px 0; }
      .meta .row span:first-child { color: #6b7280; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; text-transform: uppercase; }
      .num { text-align: right; }
      .totals { width: 360px; margin-left: auto; margin-top: 12px; }
      .totals .line { display: flex; justify-content: space-between; border-bottom: 1px solid #e5e7eb; padding: 6px 0; }
      .totals .line.total { font-size: 16px; font-weight: 700; border-bottom: 0; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div>
          <h1 class="title">Invoice</h1>
          <p class="sub">${escapeHtml(props.projectTitle)}</p>
        </div>
        <div style="text-align:right;">
          <div class="label">Invoice No</div>
          <div class="value">${escapeHtml(props.invoiceNumber)}</div>
          <div class="label" style="margin-top:8px;">Quotation No</div>
          <div>${escapeHtml(props.quotationNo)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Customer</div>
          <div class="value">${escapeHtml(props.clientName)}</div>
          <div>${escapeHtml(props.clientEmail)}</div>
          <div>${escapeHtml(props.clientPhone || "-")}</div>
        </div>
        <div class="card">
          <div class="label">Invoice Information</div>
          <div class="meta">
            <div class="row"><span>Invoice Date</span><span>${invoiceDateText}</span></div>
            <div class="row"><span>Due Date</span><span>${dueDateText}</span></div>
            <div class="row"><span>Payment Type</span><span>${escapeHtml(props.paymentType)}</span></div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Label</th>
            <th class="num">Quantity</th>
            <th class="num">Unit Price</th>
            <th class="num">GST %</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(props.productName)}</td>
            <td>${escapeHtml(props.unitLabel)}</td>
            <td class="num">${props.quantity}</td>
            <td class="num">${props.unitPrice.toFixed(2)}</td>
            <td class="num">${props.gstPercent.toFixed(2)}</td>
            <td class="num">${props.subtotalAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="line"><span>Total</span><strong>${props.totalAmount.toFixed(2)}</strong></div>
        <div class="line"><span>Paid Amount</span><strong>${props.paidAmount.toFixed(2)}</strong></div>
        <div class="line total"><span>Amount Due</span><span>${props.balanceAmount.toFixed(2)}</span></div>
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
        if (document.body.contains(frame)) document.body.removeChild(frame);
      }, 1500);
    };

    frame.onload = () => {
      const target = frame.contentWindow;
      if (!target) {
        cleanup();
        toast.error("Could not open download dialog.");
        return;
      }
      target.focus();
      target.print();
      cleanup();
    };

    const doc = frame.contentDocument;
    if (!doc) {
      cleanup();
      toast.error("Could not prepare invoice document.");
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
