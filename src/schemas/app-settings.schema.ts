import { z } from "zod";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/domain/table-settings";

export const updateAppSettingsSchema = z.object({
  defaultTablePageSize: z.coerce
    .number()
    .refine(
      (n) =>
        (TABLE_PAGE_SIZE_OPTIONS as readonly number[]).includes(n),
      `Must be one of: ${TABLE_PAGE_SIZE_OPTIONS.join(", ")}`
    ),
});
