import { z } from "zod";
import { paymentReceiptSchema } from "@/schemas/receipt.schema";

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const createPurchaseSchema = z.object({
  businessId: z.string().min(1),
  supplierId: z.string().min(1),
  items: z.array(purchaseItemSchema).min(1),
  tax: z.number().min(0).optional().default(0),
  referenceNumber: z.string().optional(),
  receipts: z.array(paymentReceiptSchema).max(5).optional(),
});

const purchaseLineUpdateSchema = z.object({
  index: z.number().int().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.coerce.date().optional().nullable(),
});

export const updatePurchaseSchema = z.object({
  referenceNumber: z.string().optional(),
  supplierId: z.string().min(1).optional(),
  tax: z.number().min(0).optional(),
  receipts: z.array(paymentReceiptSchema).max(5).optional(),
  lineUpdates: z.array(purchaseLineUpdateSchema).optional(),
});
