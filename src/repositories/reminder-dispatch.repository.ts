import { reminderDedupeKey } from "@/domain/reminders";
import type { ReminderKind, ReminderReferenceType } from "@/domain/reminders";
import { ReminderDispatchModel } from "@/models/reminder-dispatch.model";

export const reminderDispatchRepository = {
  /** Returns true if this reminder was newly recorded (send it). */
  async tryClaim(input: {
    businessId: string;
    kind: ReminderKind;
    referenceType: ReminderReferenceType;
    referenceId: string;
    anchorDate: string;
  }): Promise<boolean> {
    const dedupeKey = reminderDedupeKey(
      input.kind,
      input.referenceType,
      input.referenceId,
      input.anchorDate
    );
    try {
      await ReminderDispatchModel.create({
        ...input,
        dedupeKey,
        createdAt: new Date(),
      });
      return true;
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 11000) return false;
      throw err;
    }
  },
};
