import Link from "next/link";
import { createInrFormatter, formatQuotationPaymentInput } from "./helpers";
import type {
  CrmQuotationDetailInvoice,
  CrmQuotationDetailPayment,
} from "./types";

interface CrmQuotationDetailDownPaymentProps {
  balanceAmount: number;
  canCreateInvoice: boolean;
  invoice: CrmQuotationDetailInvoice | null;
  invoiceHref: string;
  paidAmount: number;
  payments: CrmQuotationDetailPayment[];
}

export function CrmQuotationDetailDownPayment({
  balanceAmount,
  canCreateInvoice,
  invoice,
  invoiceHref,
  paidAmount,
  payments,
}: CrmQuotationDetailDownPaymentProps) {
  const currency = createInrFormatter();

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Down Payment</h2>
      </div>
      {!canCreateInvoice ? (
        <p className="mb-4 text-sm text-slate-500">
          Confirm the quotation first. Invoice creation is available only after confirmation.
        </p>
      ) : null}
      {invoice ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Invoice Status</p>
              <p className="font-semibold text-slate-900">Created</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Payment Type</p>
              <p className="font-semibold text-slate-900">{invoice.paymentType}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Paid Amount</p>
              <p className="font-semibold text-slate-900">{currency.format(paidAmount)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-slate-500">Balance</p>
              <p className="font-semibold text-slate-900">{currency.format(balanceAmount)}</p>
            </div>
          </div>

          <div className="rounded-md border">
            <div className="border-b bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Payment Entries</h3>
              <p className="text-xs text-slate-500">All down payment records are shown separately below.</p>
            </div>

            {payments.length > 0 ? (
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium text-slate-700">Recorded On</th>
                      <th className="p-3 font-medium text-slate-700">Payment Type</th>
                      <th className="p-3 font-medium text-slate-700">Input</th>
                      <th className="p-3 font-medium text-slate-700">Paid Amount</th>
                      <th className="p-3 font-medium text-slate-700 text-right">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const paymentDetailHref = `${invoiceHref}/payments/${payment.id}`;

                      return (
                        <tr
                          key={payment.id}
                          className="border-b align-top transition-colors hover:bg-slate-50 last:border-0"
                        >
                          <td className="p-0 text-slate-700">
                            <Link href={paymentDetailHref} className="block p-3 hover:text-cyan-700">
                              {new Date(payment.createdAt).toLocaleString()}
                            </Link>
                          </td>
                          <td className="p-0 font-medium text-slate-900">
                            <Link href={paymentDetailHref} className="block p-3 hover:text-cyan-700">
                              {payment.paymentType}
                            </Link>
                          </td>
                          <td className="p-0 text-slate-700">
                            <Link href={paymentDetailHref} className="block p-3 hover:text-cyan-700">
                              {formatQuotationPaymentInput(payment, currency)}
                            </Link>
                          </td>
                          <td className="p-0 font-semibold text-slate-900">
                            <Link href={paymentDetailHref} className="block p-3 hover:text-cyan-700">
                              {currency.format(payment.paidAmount)}
                            </Link>
                          </td>
                          <td className="p-0 text-right">
                            <Link
                              href={paymentDetailHref}
                              className="inline-flex items-center justify-end p-3 font-medium text-cyan-700 hover:text-cyan-800"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-sm text-slate-600">No payment entries added yet.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-slate-600">
          No invoice created for this quotation yet.
        </div>
      )}
    </div>
  );
}
