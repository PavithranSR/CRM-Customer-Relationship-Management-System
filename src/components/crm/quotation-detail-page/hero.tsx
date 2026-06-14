import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { CrmQuotationConfirmButton } from "@/components/crm/crm-quotation-confirm-button";
import { CrmQuotationDeleteButton } from "@/components/crm/crm-quotation-delete-button";
import { CrmQuotationExportButton } from "@/components/crm/crm-quotation-export-button";
import { CrmQuotationSendButton } from "@/components/crm/crm-quotation-send-button";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type {
  CrmQuotationDetailDeletedInvoice,
  CrmQuotationDetailItem,
  CrmQuotationDetailLead,
  CrmQuotationDetailInvoice,
  CrmQuotationDetailQuotation,
} from "./types";

interface CrmQuotationDetailHeroProps {
  canCreateInvoice: boolean;
  canDeleteQuotation: boolean;
  canUpdateQuotation: boolean;
  crmLeadId: string;
  deletedInvoice: CrmQuotationDetailDeletedInvoice | null;
  deletedInvoiceHref: string;
  invoice: CrmQuotationDetailInvoice | null;
  invoiceHref: string;
  items: CrmQuotationDetailItem[];
  lead: CrmQuotationDetailLead;
  quotation: CrmQuotationDetailQuotation;
  quotationBackHref: string;
  quotationHref: string;
}

export function CrmQuotationDetailHero({
  canCreateInvoice,
  canDeleteQuotation,
  canUpdateQuotation,
  crmLeadId,
  deletedInvoice,
  deletedInvoiceHref,
  invoice,
  invoiceHref,
  items,
  lead,
  quotation,
  quotationBackHref,
  quotationHref,
}: CrmQuotationDetailHeroProps) {
  const unitCount = Number(quotation.unitCount || 0);
  const unitPrice = Number(quotation.unitPrice || 0);
  const gstPercent = Number(quotation.gstPercent || 0);
  const subtotalAmount = Number(quotation.subtotalAmount || 0);
  const gstAmount = Number(quotation.gstAmount || 0);
  const totalAmount = Number(quotation.totalAmount || 0);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold">Quotation {quotation.quotationNo}</h1>
        <p className="text-sm text-slate-600">{quotation.projectTitle}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline">
          <Link href={quotationBackHref}>Back</Link>
        </Button>
        {!canCreateInvoice && canUpdateQuotation ? (
          <CrmQuotationConfirmButton
            quotationId={quotation.id}
            crmLeadId={crmLeadId}
            quotationHref={quotationHref}
          />
        ) : !canCreateInvoice ? (
          <Button type="button" disabled>
            Confirm Quotation First
          </Button>
        ) : (
          <Button asChild>
            <Link href={invoiceHref}>{invoice ? "View Invoice" : "Create Invoice"}</Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open quotation actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {deletedInvoice ? (
              <DropdownMenuItem asChild>
                <Link href={deletedInvoiceHref}>Deleted Invoice</Link>
              </DropdownMenuItem>
            ) : null}
            <div className="p-1 [&_button]:h-auto [&_button]:w-full [&_button]:justify-start [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-2 [&_button]:py-1.5 [&_button]:font-normal [&_button]:text-foreground [&_button]:shadow-none [&_button:hover]:bg-transparent [&_button:hover]:text-foreground [&_button:active]:bg-transparent [&_button:focus-visible]:ring-0">
              <CrmQuotationExportButton
                quotationNo={quotation.quotationNo}
                title={quotation.title}
                status={quotation.status}
                sentAt={quotation.sentAt ? new Date(quotation.sentAt).toISOString() : null}
                createdAt={new Date(quotation.createdAt).toISOString()}
                validUntil={quotation.validUntil ? new Date(quotation.validUntil).toISOString() : null}
                clientName={quotation.clientName}
                clientEmail={quotation.clientEmail}
                clientPhone={lead.phone}
                projectTitle={quotation.projectTitle}
                serviceName={quotation.serviceName}
                unitName={quotation.unitName}
                unitCount={unitCount}
                unitPrice={unitPrice}
                gstPercent={gstPercent}
                subtotalAmount={subtotalAmount}
                gstAmount={gstAmount}
                totalAmount={totalAmount}
                terms={quotation.terms}
                notes={quotation.notes}
                items={items.map((item) => ({
                  name: item.name,
                  unitCount: item.unitCount,
                  amount: item.amount,
                  gstPercent: item.gstPercent,
                  tags: item.tags,
                }))}
              />
              {canUpdateQuotation ? (
                <CrmQuotationSendButton
                  quotationId={quotation.id}
                  isResend={quotation.status === "SENT"}
                />
              ) : null}
              {canDeleteQuotation ? (
                <CrmQuotationDeleteButton quotationId={quotation.id} crmLeadId={crmLeadId} />
              ) : null}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
