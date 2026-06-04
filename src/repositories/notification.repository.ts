import type { Notification } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  type PaginatedResult,
} from "@/lib/pagination";
import { NotificationModel } from "@/models/notification.model";

export const notificationRepository = {
  async findByBusinessPaginated(
    businessId: string,
    options: { unreadOnly?: boolean; page: number; pageSize: number }
  ): Promise<PaginatedResult<Notification>> {
    const filter: Record<string, unknown> = { businessId };
    if (options.unreadOnly) filter.isRead = false;
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      NotificationModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      NotificationModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Notification);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async countUnread(businessId: string): Promise<number> {
    return NotificationModel.countDocuments({ businessId, isRead: false });
  },

  async create(
    data: Omit<Notification, "_id">
  ): Promise<Notification> {
    const doc = await NotificationModel.create(data);
    return mapId(doc.toObject()) as Notification;
  },

  async findByDedupeKey(
    businessId: string,
    dedupeKey: string
  ): Promise<Notification | null> {
    const doc = await NotificationModel.findOne({ businessId, dedupeKey }).lean();
    return doc ? (mapId(doc) as Notification) : null;
  },

  async updateExpiryAlertContent(
    businessId: string,
    dedupeKey: string,
    data: Pick<
      Notification,
      "type" | "title" | "message" | "referenceType" | "referenceId"
    >
  ): Promise<boolean> {
    const result = await NotificationModel.updateOne(
      { businessId, dedupeKey },
      {
        $set: {
          type: data.type,
          title: data.title,
          message: data.message,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
        },
      }
    );
    return result.matchedCount > 0;
  },

  /**
   * Upsert by dedupeKey — refreshes message and marks unread when the same
   * alert fires again (e.g. stock drops again after a restock).
   */
  async upsertByDedupeKey(
    businessId: string,
    dedupeKey: string,
    data: Omit<
      Notification,
      "_id" | "businessId" | "dedupeKey" | "isRead" | "createdAt"
    >,
    options?: { markUnread?: boolean }
  ): Promise<Notification> {
    const existing = await NotificationModel.findOne({ businessId, dedupeKey }).lean();
    const setFields: Record<string, unknown> = {
      ...data,
      businessId,
      dedupeKey,
    };
    if (!existing) {
      setFields.isRead = false;
      setFields.createdAt = new Date();
    } else if (options?.markUnread) {
      setFields.isRead = false;
      setFields.createdAt = new Date();
    }

    const doc = await NotificationModel.findOneAndUpdate(
      { businessId, dedupeKey },
      { $set: setFields },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return mapId(doc!) as Notification;
  },

  async deleteExpiryAlertsNotIn(
    businessId: string,
    dedupeKeys: string[]
  ): Promise<number> {
    const filter: Record<string, unknown> = {
      businessId,
      type: { $in: ["EXPIRY_WARNING", "EXPIRY_CRITICAL"] },
    };
    if (dedupeKeys.length > 0) {
      filter.dedupeKey = { $nin: dedupeKeys };
    }
    const result = await NotificationModel.deleteMany(filter);
    return result.deletedCount;
  },

  async markRead(id: string): Promise<Notification | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await NotificationModel.findByIdAndUpdate(
      oid,
      { $set: { isRead: true } },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Notification) : null;
  },

  async markAllRead(businessId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { businessId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  },

  async findById(id: string): Promise<Notification | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await NotificationModel.findById(oid).lean();
    return doc ? (mapId(doc) as Notification) : null;
  },

  async delete(id: string): Promise<boolean> {
    const oid = toObjectId(id);
    if (!oid) return false;
    const result = await NotificationModel.deleteOne({ _id: oid });
    return result.deletedCount > 0;
  },
};
