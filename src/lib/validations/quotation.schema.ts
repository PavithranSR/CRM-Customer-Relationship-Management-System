import { z } from "zod";

export const quotationStatusSchema = z.enum(["DRAFT", "SENT"]);
export const paymentTypeSchema = z.enum(["FIXED", "PERCENTAGE", "MONTHLY"]);

export const createQuotationSchema = z.object({
  title: z.string().min(1, "Quotation title is required").max(160),
  clientName: z.string().min(1, "Client name is required").max(120),
  clientEmail: z.string().email("Valid client email is required"),
  projectTitle: z.string().min(1, "Project title is required").max(160),
  serviceName: z.string().max(120).optional(),
  unitName: z.string().max(80).optional(),
  unitCount: z.coerce.number().nonnegative(),
  unitPrice: z.coerce.number().nonnegative(),
  gstPercent: z.coerce.number().min(0).max(100),
  terms: z.string().max(3000).optional(),
  notes: z.string().max(3000).optional(),
  validUntil: z.coerce.date().optional(),
});

export const upsertInvoiceSchema = z.object({
  paymentType: paymentTypeSchema,
  amount: z.coerce.number().nonnegative().optional(),
  percentage: z.coerce.number().min(0).max(100).optional(),
  months: z.coerce.number().int().min(1).max(120).optional(),
  notes: z.string().max(1000).optional(),
});
