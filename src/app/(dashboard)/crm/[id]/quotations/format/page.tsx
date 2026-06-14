import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Button } from "@/components/ui/button";

interface CrmQuotationFormatPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmQuotationFormatPage({ params }: CrmQuotationFormatPageProps) {
  const { id } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const lead = await getCrmLead(id);
  if (!lead) {
    notFound();
  }

  const unitCount = lead.unitCount ?? 1;
  const unitPrice = lead.unitPrice ?? 0;
  const gstPercent = lead.gstPercent ?? 18;
  const subtotal = unitCount * unitPrice;
  const gstAmount = subtotal * (gstPercent / 100);
  const total = subtotal + gstAmount;

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="orders" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Quotation Format</h1>
          <p className="text-sm text-slate-600">Template for {lead.title}</p>
          <div className="mt-2">
            <CrmQuotationNav leadId={id} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/crm/${id}`}>Back to Lead</Link>
          </Button>
          <Button asChild>
            <Link href={`/crm/${id}/quotations/new`}>Use This Format</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white p-5">
        <div className="border-b pb-4">
          <p className="text-xs text-slate-500">Client</p>
          <h2 className="text-xl font-semibold">{lead.clientName || "-"}</h2>
          <p className="text-sm text-slate-600">{lead.email || "-"}</p>
          <p className="text-sm text-slate-600">{lead.phone || "-"}</p>
        </div>

        <div className="py-4">
          <p className="text-xs text-slate-500">Project</p>
          <p className="font-medium">{lead.title}</p>
          <p className="text-sm text-slate-600">Service: {lead.serviceName || "-"}</p>
        </div>

        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-3">Description</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3">{lead.unitName || lead.serviceName || "Service Item"}</td>
                <td className="p-3">{unitCount}</td>
                <td className="p-3">{unitPrice.toFixed(2)}</td>
                <td className="p-3">{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-2 text-sm sm:ml-auto sm:w-[320px]">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span>{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">GST ({gstPercent}%)</span>
            <span>{gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6 rounded-md border bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-medium">Terms & Conditions</p>
          <p className="mt-1">50% advance before start. Remaining amount payable before final delivery.</p>
        </div>
      </div>
    </div>
  );
}
