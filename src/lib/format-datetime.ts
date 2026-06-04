function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Time as `HH:mm` (24h-style display via locale). */
export function formatTimeHm(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date as `yyyy/mm/dd`. */
export function formatDateYmd(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** Date and time as `yyyy/mm/dd HH:mm`. */
export function formatDateTimeYmd(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDateYmd(d)} ${formatTimeHm(d)}`;
}

/** Clock range as `HH:mm – HH:mm`. */
export function formatTimeRange(
  startAt: Date | string,
  endAt: Date | string
): string {
  return `${formatTimeHm(startAt)} – ${formatTimeHm(endAt)}`;
}

/** Format an appointment slot for ledger tables. */
export function formatAppointmentSlot(
  startAt: Date | string,
  endAt: Date | string
): { date: string; timeRange: string } {
  return {
    date: formatDateYmd(startAt),
    timeRange: formatTimeRange(startAt, endAt),
  };
}

/** Format a product sale checkout timestamp for ledger tables. */
export function formatSaleTimestamp(occurredAt: Date | string): {
  date: string;
  time: string;
} {
  return {
    date: formatDateYmd(occurredAt),
    time: formatTimeHm(occurredAt),
  };
}

/** Month bucket label as `yyyy/mm`. */
export function formatMonthYmd(year: number, month: number): string {
  return `${year}/${pad(month)}`;
}
