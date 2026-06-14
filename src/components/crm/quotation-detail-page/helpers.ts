import { Prisma } from "@prisma/client";
import type { CrmQuotationDetailPayment } from "./types";

export function isDatabaseConnectionError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P2024")
  ) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  if (error instanceof Error) {
    return /can't reach database server/i.test(error.message);
  }
  return false;
}

export function getProjectCategoryFromTags(tags: string | null) {
  if (!tags) return null;
  const match = tags.match(/(?:^|,)\s*Category\s*:\s*([^,]+)/i);
  return match?.[1]?.trim() || null;
}

export function getVisibleProjectTags(tags: string | null) {
  if (!tags) return "-";

  const visibleTags = tags
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^category\s*:/i.test(entry));

  return visibleTags.length > 0 ? visibleTags.join(", ") : "-";
}

export function createInrFormatter() {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
}

export function formatQuotationPaymentInput(
  payment: CrmQuotationDetailPayment,
  currency: Intl.NumberFormat
) {
  if (payment.paymentType === "PERCENTAGE") {
    return `${Number(payment.percentage || 0).toFixed(2)}%`;
  }
  if (payment.paymentType === "MONTHLY") {
    return `${currency.format(Number(payment.amount || 0))} x ${payment.months || 1}`;
  }
  return currency.format(Number(payment.amount || 0));
}

