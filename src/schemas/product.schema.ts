import { z } from "zod";
import { BUSINESS_TYPES } from "@/domain/business-types";

export const createProductSchema = z.object({
  businessId: z.string().min(1),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  categoryId: z.string().optional(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120),
  sku: z.string().min(1).max(60),
  unitId: z.string().optional(),
  pricing: z.object({
    purchase: z.number().min(0),
    selling: z.number().min(0),
  }),
  trackExpiry: z.boolean().optional().default(false),
  minStock: z.number().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema
  .omit({ businessId: true })
  .partial();
