import { calendarDayRange } from "@/lib/reminder-dates";

/** Days before expiry to raise a warning (design: Phase 2 expiry engine). */
export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryAlertLevel = "warning" | "critical";

/** YYYY-MM-DD for a Date in the reminder timezone. */
export function calendarDateKey(date: Date): string {
  return calendarDayRange(0, date).key;
}

export function expiryAlertLevel(
  expiryDate: Date,
  asOf = new Date()
): ExpiryAlertLevel | null {
  const todayKey = calendarDayRange(0, asOf).key;
  const warningThroughKey = calendarDayRange(EXPIRY_WARNING_DAYS, asOf).key;
  const expiryKey = calendarDateKey(expiryDate);

  if (expiryKey < todayKey) return "critical";
  if (expiryKey <= warningThroughKey) return "warning";
  return null;
}
