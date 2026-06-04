import { z } from "zod";
import { USER_ROLES } from "@/domain/roles";

const roleEnum = z.enum(USER_ROLES as [string, ...string[]]);

export const createTeamMemberSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Enter a valid email").max(200),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  role: roleEnum,
});

export const updateTeamMemberSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().max(200).optional(),
    role: roleEnum.optional(),
    isActive: z.boolean().optional(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100)
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "No changes provided",
  });
