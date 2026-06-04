import { z } from "zod";
import { BUSINESS_TYPES } from "@/domain/business-types";

const businessSettingsSchema = z.object({
  currency: z.string().optional(),
  timezone: z.string().optional(),
  invoicePrefix: z.string().optional(),
  logoUrl: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
});

export const createBusinessSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  code: z.string().min(1).max(20),
  type: z.enum(BUSINESS_TYPES).optional().default("GENERAL"),
  isActive: z.boolean().optional().default(true),
  settings: businessSettingsSchema.optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  type: z.enum(BUSINESS_TYPES).optional(),
  isActive: z.boolean().optional(),
  settings: businessSettingsSchema.optional(),
});
