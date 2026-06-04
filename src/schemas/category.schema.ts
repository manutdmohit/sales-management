import { z } from "zod";

export const createCategorySchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema
  .omit({ businessId: true })
  .partial();
