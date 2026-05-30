export type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

export type ReportBucket = {
  label: string;
  date: string;
  count: number;
  total: number;
};

export type ReportResult = {
  kind: "sales" | "purchases";
  period: ReportPeriod;
  from: string;
  to: string;
  buckets: ReportBucket[];
  totalCount: number;
  totalAmount: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function resolveReportRange(
  period: ReportPeriod,
  fromParam?: string,
  toParam?: string
): { from: Date; to: Date } {
  const to = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());

  if (period === "custom") {
    if (!fromParam || !toParam) {
      throw new Error("from and to are required for custom period");
    }
    const from = startOfDay(new Date(fromParam));
    if (from > to) {
      throw new Error("from must be before to");
    }
    return { from, to };
  }

  const from = new Date(to);

  if (period === "daily") {
    from.setDate(from.getDate() - 29);
    return { from: startOfDay(from), to };
  }

  if (period === "weekly") {
    from.setDate(from.getDate() - 7 * 11 - 6);
    return { from: startOfDay(from), to };
  }

  from.setMonth(from.getMonth() - 11);
  from.setDate(1);
  return { from: startOfDay(from), to };
}

export function bucketKeyForDate(date: Date, period: ReportPeriod): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  if (period === "monthly") return `${y}-${m}`;
  if (period === "weekly") return isoWeekKey(date);
  return `${y}-${m}-${d}`;
}

function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function bucketLabel(key: string, period: ReportPeriod): string {
  if (period === "monthly") {
    const [y, m] = key.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }
  if (period === "weekly") {
    return key.replace("-W", " W");
  }
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function iterateBucketKeys(
  from: Date,
  to: Date,
  period: ReportPeriod
): string[] {
  const keys: string[] = [];
  const cursor = new Date(from);

  while (cursor <= to) {
    const key = bucketKeyForDate(cursor, period);
    if (keys[keys.length - 1] !== key) keys.push(key);

    if (period === "monthly") {
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    } else if (period === "weekly") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return keys;
}

export function mongoDateFormat(period: ReportPeriod): string {
  if (period === "monthly") return "%Y-%m";
  if (period === "weekly") return "%G-W%V";
  return "%Y-%m-%d";
}

export function normalizeMongoWeekKey(key: string): string {
  const match = key.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return key;
  return `${match[1]}-W${match[2].padStart(2, "0")}`;
}
