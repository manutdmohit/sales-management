import type { Notification, NotificationType } from "@/domain/types";
import { sanitizeDecimalInText } from "@/lib/format-quantity";
import { AppError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/pagination";
import { notificationRepository } from "@/repositories/notification.repository";
import { businessService } from "./business.service";

type CreateNotificationInput = {
  businessId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: Notification["referenceType"];
  referenceId?: string;
  dedupeKey?: string;
};

export const notificationService = {
  async list(
    businessId: string,
    options?: { unreadOnly?: boolean; page?: number; pageSize?: number }
  ): Promise<PaginatedResult<Notification>> {
    await businessService.getById(businessId);
    const result = await notificationRepository.findByBusinessPaginated(
      businessId,
      {
        unreadOnly: options?.unreadOnly ?? false,
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
      }
    );
    return {
      ...result,
      items: result.items.map((n) => ({
        ...n,
        message: sanitizeDecimalInText(n.message),
      })),
    };
  },

  async unreadCount(businessId: string): Promise<number> {
    await businessService.getById(businessId);
    return notificationRepository.countUnread(businessId);
  },

  async create(input: CreateNotificationInput): Promise<Notification> {
    return notificationRepository.create({
      ...input,
      isRead: false,
      createdAt: new Date(),
    });
  },

  async createOrRefresh(
    input: CreateNotificationInput & { dedupeKey: string },
    options?: { markUnread?: boolean }
  ): Promise<Notification> {
    const { dedupeKey, businessId, ...data } = input;
    return notificationRepository.upsertByDedupeKey(
      businessId,
      dedupeKey,
      data,
      options
    );
  },

  async markRead(id: string): Promise<Notification> {
    const updated = await notificationRepository.markRead(id);
    if (!updated) {
      throw new AppError("Notification not found", 404, "NOT_FOUND");
    }
    return updated;
  },

  async markAllRead(businessId: string): Promise<number> {
    await businessService.getById(businessId);
    return notificationRepository.markAllRead(businessId);
  },

  async delete(id: string): Promise<void> {
    const existing = await notificationRepository.findById(id);
    if (!existing) {
      throw new AppError("Notification not found", 404, "NOT_FOUND");
    }
    await businessService.getById(existing.businessId);
    const deleted = await notificationRepository.delete(id);
    if (!deleted) {
      throw new AppError("Notification not found", 404, "NOT_FOUND");
    }
  },
};
