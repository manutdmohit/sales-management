export type ReminderKind =
  | "CREDIT_DUE_DAY_BEFORE"
  | "CREDIT_DUE_ON"
  | "FOLLOWUP_DAY_BEFORE"
  | "FOLLOWUP_ON"
  | "EXPIRY_WARNING"
  | "EXPIRY_CRITICAL";

export type ReminderReferenceType = "sale" | "appointment" | "batch";

export function reminderDedupeKey(
  kind: ReminderKind,
  referenceType: ReminderReferenceType,
  referenceId: string,
  anchorDate: string
): string {
  return `${kind}:${referenceType}:${referenceId}:${anchorDate}`;
}
