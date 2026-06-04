import { Schema, model, models } from "mongoose";
import type { ReminderKind, ReminderReferenceType } from "@/domain/reminders";

const reminderKinds: ReminderKind[] = [
  "CREDIT_DUE_DAY_BEFORE",
  "CREDIT_DUE_ON",
  "FOLLOWUP_DAY_BEFORE",
  "FOLLOWUP_ON",
  "EXPIRY_WARNING",
  "EXPIRY_CRITICAL",
];

const reminderReferenceTypes: ReminderReferenceType[] = [
  "sale",
  "appointment",
  "batch",
];

const reminderDispatchSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    kind: { type: String, required: true, enum: reminderKinds },
    referenceType: {
      type: String,
      required: true,
      enum: reminderReferenceTypes,
    },
    referenceId: { type: String, required: true },
    /** YYYY-MM-DD of the due / follow-up date the reminder refers to. */
    anchorDate: { type: String, required: true },
    dedupeKey: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "reminder_dispatches" }
);

reminderDispatchSchema.index({ businessId: 1, createdAt: -1 });

export const ReminderDispatchModel =
  models.ReminderDispatch ??
  model("ReminderDispatch", reminderDispatchSchema);
