import { z } from "zod";

export const createClientSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().min(1, "Contact number is required").max(40),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  phone: z.string().min(1).max(40).optional(),
});
