import { z } from "zod";

export const dashboardQuerySchema = z.object({
  businessId: z.string().min(1),
  period: z
    .enum(["daily", "weekly", "monthly", "yearly"])
    .default("daily"),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
