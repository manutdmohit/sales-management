import bcrypt from "bcryptjs";
import type { UserRole } from "@/domain/roles";
import { AppError } from "@/lib/errors";
import {
  buildPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
import { getAppLoginUrl } from "@/lib/email/recipients";
import { emailTemplates } from "@/lib/email/templates";
import { emailService } from "@/services/email.service";
import { userRepository } from "@/repositories/user.repository";

export type TeamMember = {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
};

type CreateInput = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

type UpdateInput = {
  name?: string;
  email?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
};

function toMember(user: {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
}): TeamMember {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export const teamService = {
  async list(options?: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<TeamMember>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const { items, total } = await userRepository.findPaginated({
      search: options?.search,
      page,
      pageSize,
    });
    return buildPaginatedResult(items.map(toMember), total, page, pageSize);
  },

  async create(input: CreateInput): Promise<TeamMember> {
    const email = input.email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new AppError(
        "A team member with this email already exists",
        409,
        "DUPLICATE_EMAIL"
      );
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await userRepository.create({
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
    });

    const welcome = emailTemplates.teamWelcome({
      name: user.name,
      email: user.email,
      role: user.role,
      loginUrl: getAppLoginUrl(),
    });
    await emailService.sendSafe({ to: user.email, ...welcome });

    return toMember(user);
  },

  async update(
    id: string,
    input: UpdateInput,
    actingUserId: string
  ): Promise<TeamMember> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new AppError("Team member not found", 404, "NOT_FOUND");
    }

    const isSelf = existing._id === actingUserId;

    // Guard against locking out the platform: keep at least one active admin.
    const losesAdmin =
      existing.role === "ADMIN" &&
      ((input.role && input.role !== "ADMIN") || input.isActive === false);
    if (losesAdmin) {
      const activeAdmins = await userRepository.countActiveByRole("ADMIN");
      if (activeAdmins <= 1) {
        throw new AppError(
          "At least one active admin is required",
          400,
          "LAST_ADMIN"
        );
      }
    }

    if (isSelf && input.isActive === false) {
      throw new AppError(
        "You cannot deactivate your own account",
        400,
        "SELF_DEACTIVATE"
      );
    }

    if (input.email) {
      const email = input.email.toLowerCase().trim();
      const clash = await userRepository.findByEmail(email);
      if (clash && clash._id !== id) {
        throw new AppError(
          "Another team member already uses this email",
          409,
          "DUPLICATE_EMAIL"
        );
      }
    }

    const passwordHash = input.password
      ? await bcrypt.hash(input.password, 12)
      : undefined;

    const updated = await userRepository.update(id, {
      name: input.name?.trim(),
      email: input.email?.toLowerCase().trim(),
      role: input.role,
      isActive: input.isActive,
      passwordHash,
    });
    if (!updated) {
      throw new AppError("Team member not found", 404, "NOT_FOUND");
    }
    return toMember(updated);
  },

  async setActive(
    id: string,
    isActive: boolean,
    actingUserId: string
  ): Promise<TeamMember> {
    return this.update(id, { isActive }, actingUserId);
  },
};
