/** IANA timezone for calendar-day matching (Vercel runs in UTC). */
export function reminderTimeZone(): string {
  return process.env.REMINDER_TIMEZONE?.trim() || "Asia/Kathmandu";
}

function getZonedParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  for (let i = 0; i < 4; i++) {
    const p = getZonedParts(new Date(utc), timeZone);
    const desiredMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const actualMs = Date.UTC(
      p.year,
      p.month - 1,
      p.day,
      p.hour,
      p.minute,
      p.second,
      0
    );
    utc += desiredMs - actualMs;
  }
  return new Date(utc);
}

/** Calendar-day bounds in REMINDER_TIMEZONE (default Asia/Kathmandu). */
export function calendarDayRange(
  dayOffset: number,
  from = new Date()
): { start: Date; end: Date; key: string } {
  const tz = reminderTimeZone();
  const now = getZonedParts(from, tz);
  const anchor = new Date(
    Date.UTC(now.year, now.month - 1, now.day + dayOffset)
  );
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth() + 1;
  const d = anchor.getUTCDate();
  const start = zonedTimeToUtc(y, m, d, 0, 0, 0, 0, tz);
  const end = zonedTimeToUtc(y, m, d, 23, 59, 59, 999, tz);
  const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return { start, end, key };
}

/** Calendar date in REMINDER_TIMEZONE as `yyyy/mm/dd`. */
export function formatCalendarDate(d: Date | string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const tz = reminderTimeZone();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "00";
  const day = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${year}/${month}/${day}`;
}
