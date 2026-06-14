import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getLeadQuotations } from "@/actions/quotation.actions";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { Button } from "@/components/ui/button";
import { withInternalBackHref } from "@/lib/internal-navigation";

interface CrmLeadQuotationsPageProps {
  params: Promise<{ id: string }>;
}

const formatAmount = (value: number | null) => (value === null ? "-" : value.toFixed(2));

export default async function CrmLeadQuotationsPage({ params }: CrmLeadQuotationsPageProps) {
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

  const quotations = await getLeadQuotations(id);
  const currentPageHref = `/crm/${id}/quotations`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Old Quotations</h1>
          <p className="text-sm text-slate-600">{lead.clientName || lead.title}</p>
          <div className="mt-2">
            <CrmQuotationNav leadId={id} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/crm/${id}`}>Back to Lead</Link>
          </Button>
          <Button asChild>
            <Link href={`/crm/${id}/quotations/new`}>New Quotation</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-3">Quotation No</th>
              <th className="p-3">Title</th>
              <th className="p-3">Status</th>
              <th className="p-3">Total</th>
              <th className="p-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No quotations yet
                </td>
              </tr>
            ) : (
              quotations.map((quotation) => (
                <tr key={quotation.id} className="border-b hover:bg-slate-50">
                  <td className="p-3">
                    <Link
                      href={withInternalBackHref(`/crm/${id}/quotations/${quotation.id}`, currentPageHref)}
                      className="font-medium hover:underline"
                    >
                      {quotation.quotationNo}
                    </Link>
                  </td>
                  <td className="p-3">{quotation.title}</td>
                  <td className="p-3">{quotation.status}</td>
                  <td className="p-3">{formatAmount(quotation.totalAmount)}</td>
                  <td className="p-3">{new Date(quotation.createdAt).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
