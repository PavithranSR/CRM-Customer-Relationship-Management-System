import { z } from "zod";

export const createClientSchema = z.object({
  name: z.string().min(1, "Student name is required").max(120),
  collegeName: z.string().max(150).optional(),
  courseName: z.string().max(150).optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(80).optional(),
  serviceName: z.string().max(120).optional(),
  projectName: z.string().max(120).optional(),
  tags: z.string().max(300).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1, "Student name is required").max(120).optional(),
  collegeName: z.string().max(150).optional(),
  courseName: z.string().max(150).optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z.string().max(30).optional(),
  street: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(80).optional(),
  serviceName: z.string().max(120).optional(),
  projectName: z.string().max(120).optional(),
  tags: z.string().max(300).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
