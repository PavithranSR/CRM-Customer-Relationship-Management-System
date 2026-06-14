export const QUOTATION_DELETE_NOTICE_PARAM = "deleteNotice";
export const QUOTATION_DELETE_NOTICE_INVOICE_FIRST = "invoice-first";
export const QUOTATION_DELETE_BLOCKED_COUNT_PARAM = "blockedCount";
export const QUOTATION_DELETE_BLOCKED_REF_PARAM = "blockedRef";

export function isInvoiceFirstDeleteNotice(value: string | null | undefined) {
  return (value || "").trim().toLowerCase() === QUOTATION_DELETE_NOTICE_INVOICE_FIRST;
}

export function applyInvoiceFirstDeleteNotice(
  params: URLSearchParams,
  options?: {
    blockedCount?: number;
    blockedRef?: string | null;
  },
) {
  const next = new URLSearchParams(params.toString());
  next.set(QUOTATION_DELETE_NOTICE_PARAM, QUOTATION_DELETE_NOTICE_INVOICE_FIRST);

  const blockedCount = Number(options?.blockedCount || 0);
  if (Number.isFinite(blockedCount) && blockedCount > 1) {
    next.set(QUOTATION_DELETE_BLOCKED_COUNT_PARAM, String(blockedCount));
  } else {
    next.delete(QUOTATION_DELETE_BLOCKED_COUNT_PARAM);
  }

  const blockedRef = (options?.blockedRef || "").trim();
  if (blockedRef) {
    next.set(QUOTATION_DELETE_BLOCKED_REF_PARAM, blockedRef);
  } else {
    next.delete(QUOTATION_DELETE_BLOCKED_REF_PARAM);
  }

  return next;
}

export function clearQuotationDeleteNotice(params: URLSearchParams) {
  const next = new URLSearchParams(params.toString());
  next.delete(QUOTATION_DELETE_NOTICE_PARAM);
  next.delete(QUOTATION_DELETE_BLOCKED_COUNT_PARAM);
  next.delete(QUOTATION_DELETE_BLOCKED_REF_PARAM);
  return next;
}
