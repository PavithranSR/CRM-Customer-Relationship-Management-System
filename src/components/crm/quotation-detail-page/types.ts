import type { getCrmLead } from "@/actions/crm.actions";
import type {
  getAllCrmQuotations,
  getCrmQuotation,
  getDeletedQuotationInvoiceByQuotationId,
  getQuotationInvoice,
  getQuotationItems,
  getQuotationPayments,
} from "@/actions/quotation.actions";

export interface CrmQuotationDetailPageProps {
  params: Promise<{ id: string; quotationId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

export type CrmQuotationDetailLead = NonNullable<Awaited<ReturnType<typeof getCrmLead>>>;
export type CrmQuotationDetailQuotation = NonNullable<Awaited<ReturnType<typeof getCrmQuotation>>>;
export type CrmQuotationDetailItem = Awaited<ReturnType<typeof getQuotationItems>>[number];
export type CrmQuotationDetailInvoice = NonNullable<Awaited<ReturnType<typeof getQuotationInvoice>>>;
export type CrmQuotationDetailDeletedInvoice =
  NonNullable<Awaited<ReturnType<typeof getDeletedQuotationInvoiceByQuotationId>>>;
export type CrmQuotationDetailPayment = Awaited<ReturnType<typeof getQuotationPayments>>[number];
export type CrmQuotationDetailQuotationList = Awaited<ReturnType<typeof getAllCrmQuotations>>;

