import { z } from "zod";

export const reportQuerySchema = z.object({
  businessId: z.string().min(1),
  kind: z.enum(["sales", "purchases"]),
  period: z.enum(["daily", "weekly", "monthly", "custom"]).default("daily"),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
