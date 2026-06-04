import { z } from "zod";
import { paymentReceiptSchema } from "@/schemas/receipt.schema";

export const APPOINTMENT_STATUSES = [
  "BOOKED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const createAppointmentSchema = z
  .object({
    businessId: z.string().min(1),
    serviceId: z.string().min(1),
    customerName: z.string().min(1).max(200),
    customerPhone: z.string().min(1, "Phone number is required").max(40),
    customerEmail: z.string().email().max(200).optional(),
    saleType: z.enum(["IMMEDIATE", "CREDIT"]).default("IMMEDIATE"),
    paymentMethod: z.enum(["CASH", "ONLINE"]).default("CASH"),
    amountPaid: z.coerce.number().min(0).optional(),
    dueDate: z.coerce.date().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    followUpAt: z.coerce.date().optional(),
    notes: z.string().max(1000).optional(),
    paymentReceipt: paymentReceiptSchema.optional(),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "End time must be after start time",
    path: ["endAt"],
  })
  .refine((data) => data.saleType !== "CREDIT" || data.dueDate != null, {
    message: "A due date is required for a credit booking",
    path: ["dueDate"],
  });

export const updateAppointmentSchema = z
  .object({
    customerName: z.string().min(1).max(200).optional(),
    customerPhone: z.string().min(1).max(40).optional(),
    customerEmail: z.string().email().max(200).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    followUpAt: z.coerce.date().optional(),
    status: z.enum(APPOINTMENT_STATUSES).optional(),
    notes: z.string().max(1000).optional(),
    saleType: z.enum(["IMMEDIATE", "CREDIT"]).optional(),
    paymentMethod: z.enum(["CASH", "ONLINE"]).optional(),
    amountPaid: z.coerce.number().min(0).optional(),
    dueDate: z.coerce.date().optional(),
    paymentReceipt: paymentReceiptSchema.optional(),
  })
  .refine(
    (data) =>
      !(data.startAt && data.endAt) || data.endAt > data.startAt,
    {
      message: "End time must be after start time",
      path: ["endAt"],
    }
  );
