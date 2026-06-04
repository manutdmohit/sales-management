import { formatDateYmd, formatMonthYmd } from "@/lib/format-datetime";

export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly" | "custom";

/** Human-readable labels for preset report ranges (not custom). */
export const REPORT_PERIOD_OPTIONS = [
  { id: "daily", label: "Last 30 days", shortLabel: "last 30 days" },
  { id: "weekly", label: "Last 12 weeks", shortLabel: "last 12 weeks" },
  { id: "monthly", label: "Last 12 months", shortLabel: "last 12 months" },
  { id: "yearly", label: "Last 5 years", shortLabel: "last 5 years" },
] as const satisfies ReadonlyArray<{
  id: Exclude<ReportPeriod, "custom">;
  label: string;
  shortLabel: string;
}>;

export function reportPeriodLabel(period: ReportPeriod): string {
  if (period === "custom") return "Custom range";
  return (
    REPORT_PERIOD_OPTIONS.find((option) => option.id === period)?.label ?? period
  );
}

export function reportPeriodBreakdownHint(period: ReportPeriod): string {
  switch (period) {
    case "daily":
      return "by day";
    case "weekly":
      return "by week";
    case "monthly":
      return "by month";
    case "yearly":
      return "by year";
    default:
      return "";
  }
}

export type ReportLineDetail = {
  productName: string;
  quantity: number;
  lineTotal: number;
  lineCost?: number;
  /** Customer name for sales, supplier name for purchases. */
  partyName: string;
};

export type ReportBucket = {
  label: string;
  date: string;
  count: number;
  total: number;
  revenue?: number;
  cost?: number;
  /** Product sales subtotal in bucket (profit reports). */
  productRevenue?: number;
  /** Service booking revenue in bucket (profit reports). */
  serviceRevenue?: number;
  productCount?: number;
  serviceCount?: number;
  details: ReportLineDetail[];
};

export type PaymentMethodBreakdown = {
  method: "CASH" | "ONLINE";
  amount: number;
  count: number;
};

export type ReportResult = {
  kind:
    | "sales"
    | "purchases"
    | "services"
    | "production"
    | "rawConsumption"
    | "profit";
  period: ReportPeriod;
  from: string;
  to: string;
  buckets: ReportBucket[];
  totalCount: number;
  totalAmount: number;
  /** Combined revenue in range (profit reports). */
  totalRevenue?: number;
  /** Product sales subtotal in range (profit reports). */
  productRevenue?: number;
  /** Service booking revenue in range (profit reports). */
  serviceRevenue?: number;
  /** COGS in range (profit reports). */
  totalCost?: number;
  /** Cash vs Online collected in range (sales reports only). */
  paymentBreakdown?: PaymentMethodBreakdown[];
  /** Total amount actually collected in range across all methods. */
  totalCollected?: number;
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

  if (period === "yearly") {
    from.setFullYear(from.getFullYear() - 4);
    from.setMonth(0, 1);
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
  if (period === "yearly") return `${y}`;
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
  if (period === "yearly") {
    return key;
  }
  if (period === "monthly") {
    const [y, m] = key.split("-");
    return formatMonthYmd(Number(y), Number(m));
  }
  if (period === "weekly") {
    return key.replace("-W", " W");
  }
  const [y, m, d] = key.split("-").map(Number);
  return formatDateYmd(new Date(y, m - 1, d));
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
    } else if (period === "yearly") {
      cursor.setFullYear(cursor.getFullYear() + 1);
      cursor.setMonth(0, 1);
    } else if (period === "weekly") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return keys;
}

export function mongoDateFormat(period: ReportPeriod): string {
  if (period === "yearly") return "%Y";
  if (period === "monthly") return "%Y-%m";
  if (period === "weekly") return "%G-W%V";
  return "%Y-%m-%d";
}

export function normalizeMongoWeekKey(key: string): string {
  const match = key.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return key;
  return `${match[1]}-W${match[2].padStart(2, "0")}`;
}
