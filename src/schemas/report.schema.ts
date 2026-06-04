import { z } from "zod";

export const reportQuerySchema = z.object({
  businessId: z.string().min(1),
  kind: z.enum([
    "sales",
    "purchases",
    "services",
    "production",
    "rawConsumption",
    "profit",
  ]),
  period: z
    .enum(["daily", "weekly", "monthly", "yearly", "custom"])
    .default("daily"),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
