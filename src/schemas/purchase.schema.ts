import { z } from "zod";

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const createPurchaseSchema = z.object({
  businessId: z.string().min(1),
  supplierName: z.string().min(1).max(200),
  items: z.array(purchaseItemSchema).min(1),
  tax: z.number().min(0).optional().default(0),
  referenceNumber: z.string().optional(),
});
