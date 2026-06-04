import { Schema, model, models } from "mongoose";
import type { NotificationType } from "@/domain/types";

const notificationTypes: NotificationType[] = [
  "LOW_STOCK",
  "CREDIT_SALE",
  "APPOINTMENT_BOOKED",
  "CREDIT_DUE_REMINDER",
  "FOLLOWUP_REMINDER",
  "EXPIRY_WARNING",
  "EXPIRY_CRITICAL",
];

const notificationSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    type: { type: String, required: true, enum: notificationTypes },
    title: { type: String, required: true },
    message: { type: String, required: true },
    referenceType: String,
    referenceId: String,
    dedupeKey: String,
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "notifications" }
);

notificationSchema.index({ businessId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index(
  { businessId: 1, dedupeKey: 1 },
  { unique: true, sparse: true }
);

export const NotificationModel =
  models.Notification ?? model("Notification", notificationSchema);
