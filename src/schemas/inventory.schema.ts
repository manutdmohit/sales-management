import { z } from "zod";

export const createAdjustmentSchema = z.object({
  businessId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().refine((q) => q !== 0, "Quantity cannot be zero"),
  notes: z.string().optional(),
});
