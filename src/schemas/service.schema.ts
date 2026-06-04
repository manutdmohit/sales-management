import { z } from "zod";

export const createServiceSchema = z.object({
  businessId: z.string().min(1),
  name: z.string().min(1).max(200),
  category: z.string().max(120).optional(),
  price: z.number().min(0),
  durationMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateServiceSchema = createServiceSchema
  .omit({ businessId: true })
  .partial();
