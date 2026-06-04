import { z } from "zod";

export const sendClientEmailSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(10000),
  /** Use when the client record has no email yet. */
  to: z.string().trim().email().optional(),
});

export type SendClientEmailInput = z.infer<typeof sendClientEmailSchema>;
