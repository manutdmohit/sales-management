import bcrypt from "bcryptjs";
import { AppError } from "@/lib/errors";
import {
  createSessionToken,
  type SessionUser,
} from "@/lib/auth/session";
import { userRepository } from "@/repositories/user.repository";
import type { loginSchema } from "@/schemas/auth.schema";
import type { z } from "zod";

type LoginInput = z.infer<typeof loginSchema>;

export const authService = {
  async login(input: LoginInput): Promise<{ token: string; user: SessionUser }> {
    const user = await userRepository.findByEmail(input.email);
    if (!user || !user.isActive) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const sessionUser: SessionUser = {
      sub: user._id,
      email: user.email,
      name: user.name,
    };

    const token = await createSessionToken(sessionUser);
    return { token, user: sessionUser };
  },

  async getProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError("User not found", 404, "NOT_FOUND");
    }
    return {
      _id: user._id,
      email: user.email,
      name: user.name,
    };
  },

  async ensureAdminUser(email: string, password: string, name: string) {
    const existing = await userRepository.findByEmail(email);
    if (existing) return existing;

    const passwordHash = await bcrypt.hash(password, 12);
    return userRepository.create({ email, passwordHash, name });
  },
};
