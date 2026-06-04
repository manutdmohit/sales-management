import { z } from "zod";

export const createAdjustmentSchema = z.object({
  businessId: z.string().min(1),
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().refine((q) => q !== 0, "Quantity cannot be zero"),
  notes: z.string().optional(),
});

export const writeOffBatchSchema = z.object({
  businessId: z.string().min(1),
  batchId: z.string().min(1),
  type: z.enum(["EXPIRED", "DAMAGE"]),
  quantity: z.number().positive().optional(),
  notes: z.string().max(500).optional(),
});
