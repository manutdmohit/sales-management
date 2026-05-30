import { z } from "zod";

const saleItemSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
});

export const createSaleSchema = z.object({
  businessId: z.string().min(1),
  items: z.array(saleItemSchema).min(1),
  discount: z.number().min(0).optional().default(0),
  tax: z.number().min(0).optional().default(0),
  paymentMethod: z.enum(["CASH", "CARD", "UPI", "OTHER"]).default("CASH"),
});
