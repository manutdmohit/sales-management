import { z } from "zod";

export const createSupplierSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});
