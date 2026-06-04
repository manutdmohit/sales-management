import { z } from "zod";

export const createProductionRunSchema = z.object({
  businessId: z.string().min(1),
  finishedProductId: z.string().min(1),
  quantityProduced: z.coerce.number().positive(),
  batchNumber: z.string().max(100).optional(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateProductionRunInput = z.infer<typeof createProductionRunSchema>;
