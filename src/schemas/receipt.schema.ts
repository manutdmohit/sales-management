import { z } from "zod";

export const paymentReceiptSchema = z.object({
  url: z.url(),
  publicId: z.string().min(1).max(500),
  uploadedAt: z.coerce.date().optional(),
  uploadedBy: z.string().optional(),
  label: z.string().max(100).optional(),
});

export type PaymentReceiptInput = z.infer<typeof paymentReceiptSchema>;
