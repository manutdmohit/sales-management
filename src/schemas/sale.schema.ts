import { z } from "zod";
import { paymentReceiptSchema } from "@/schemas/receipt.schema";

const saleItemSchema = z.object({
  productId: z.string().min(1),
  batchId: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0).optional(),
});

const saleCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(200).optional(),
});

export const createSaleSchema = z
  .object({
    businessId: z.string().min(1),
    items: z.array(saleItemSchema).min(1),
    discount: z.number().min(0).optional().default(0),
    tax: z.number().min(0).optional().default(0),
    paymentMethod: z.enum(["CASH", "ONLINE"]).default("CASH"),
    saleType: z.enum(["IMMEDIATE", "CREDIT"]).default("IMMEDIATE"),
    customer: saleCustomerSchema,
    dueDate: z.coerce.date().optional(),
    /** Optional down-payment collected at the time of a credit sale. */
    amountPaid: z.number().min(0).optional(),
    /** QR / online payment proof for the checkout payment. */
    paymentReceipt: paymentReceiptSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.saleType !== "CREDIT") return;
    if (!data.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A due date is required for a credit sale",
        path: ["dueDate"],
      });
    }
  });

export const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "ONLINE"]).default("CASH"),
  note: z.string().max(500).optional(),
  receipt: paymentReceiptSchema.optional(),
});

export const updateSaleSchema = z.object({
  customer: saleCustomerSchema.optional(),
  saleType: z.enum(["IMMEDIATE", "CREDIT"]).optional(),
  paymentMethod: z.enum(["CASH", "ONLINE"]).optional(),
  amountPaid: z.coerce.number().min(0).optional(),
  dueDate: z.coerce.date().optional(),
  paymentReceipt: paymentReceiptSchema.optional(),
});
