import { z } from "zod";
import { BUSINESS_TYPES } from "@/domain/business-types";
import { STOCK_UNIT_IDS } from "@/domain/units";

const recipeLineSchema = z.object({
  rawProductId: z.string().min(1),
  quantityPerUnit: z.coerce.number().positive(),
});

export const createProductSchema = z.object({
  businessId: z.string().min(1),
  businessType: z.enum(BUSINESS_TYPES).optional(),
  productKind: z.enum(["RAW", "FINISHED"]).optional().default("FINISHED"),
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(120),
  sku: z.string().min(1).max(60),
  unitId: z.enum(STOCK_UNIT_IDS).optional(),  pricing: z.object({
    purchase: z.number().min(0),
    selling: z.number().min(0),
  }),
  trackExpiry: z.boolean().optional().default(false),
  minStock: z.number().min(0).optional().default(0),
  recipe: z.array(recipeLineSchema).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema
  .omit({ businessId: true })
  .partial();
