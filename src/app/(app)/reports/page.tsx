"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useBusiness } from "@/lib/business-context";
import { hasFeature } from "@/domain/capabilities";
import { formatQuantity } from "@/lib/format-quantity";
import { formatDateYmd } from "@/lib/format-datetime";
import type { ReportPeriod, ReportResult, ReportLineDetail } from "@/lib/report-ranges";
import {
  REPORT_PERIOD_OPTIONS,
  reportPeriodBreakdownHint,
} from "@/lib/report-ranges";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ReportKind = "sales" | "purchases" | "services" | "production" | "rawConsumption" | "profit";

const PERIODS = [
  ...REPORT_PERIOD_OPTIONS,
  { id: "custom" as const, label: "Custom range" },
];

function defaultCustomFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultCustomTo() {
  return new Date().toISOString().slice(0, 10);
}

type ChartPoint = {
  name: string;
  count: number;
  total: number;
  details: ReportLineDetail[];
};

const TOOLTIP_DETAIL_LIMIT = 12;

const CHART_HEIGHT = 288;

/** Mount Recharts only after the container has measurable dimensions. */
function ReportChartFrame({ children }: { children: ReactElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setSize({
          width: Math.floor(width),
          height: Math.floor(height),
        });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="h-72 min-h-72 w-full min-w-0"
      style={{ minHeight: CHART_HEIGHT }}
    >
      {size ? (
        <ResponsiveContainer width={size.width} height={size.height} minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function tooltipIndexNumber(index: unknown): number | undefined {
  if (typeof index === "number") return index;
  if (
    index &&
    typeof index === "object" &&
    "index" in index &&
    typeof index.index === "number"
  ) {
    return index.index;
  }
  return undefined;
}

function ReportChartTooltip({
  active,
  payload,
  label,
  kind,
  amountLabel,
  countLabel,
  itemLabel = "Product",
  onKeepOpen,
}: {
  active?: boolean;
  payload?: unknown;
  label?: string | number;
  kind: ReportKind;
  amountLabel: string;
  countLabel: string;
  itemLabel?: string;
  onKeepOpen?: () => void;
}) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;

  const entries = payload as {
    payload?: ChartPoint;
    name?: string;
    value?: number;
  }[];
  const point = entries[0].payload;
  if (!point) return null;
  const details = point.details ?? [];
  const shown = details.slice(0, TOOLTIP_DETAIL_LIMIT);
  const remaining = details.length - shown.length;
  const partyLabel =
    kind === "purchases"
      ? "Supplier"
      : kind === "production"
        ? "Note"
        : kind === "rawConsumption"
          ? "Used for"
          : kind === "profit"
            ? "Customer"
            : "Customer";
  const isMonetary = kind !== "production";
  const showLineCost = kind === "profit";

  return (
    <div
      className="max-w-xs rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md"
      onPointerDown={(e) => {
        e.stopPropagation();
        onKeepOpen?.();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="font-medium">{label}</p>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {entries.map((entry) => (
          <p key={String(entry.name)}>
            <span className="text-foreground">{entry.name}: </span>
            {typeof entry.value === "number"
              ? entry.name === amountLabel
                ? isMonetary
                  ? entry.value.toFixed(2)
                  : formatQuantity(entry.value)
                : entry.value
              : String(entry.value ?? "")}
          </p>
        ))}
      </div>
      {shown.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-border/60 pt-2 text-xs">
          {shown.map((line, index) => (
            <li key={`${line.productName}-${line.partyName}-${index}`}>
              <span className="font-medium text-foreground">
                {line.productName}
              </span>
              <span className="text-muted-foreground">
                {" "}
                ×{line.quantity}
              </span>
              <span className="text-muted-foreground"> → </span>
              <span>{line.partyName}</span>
              {isMonetary && (
                <span className="ml-1 font-mono text-muted-foreground">
                  ({line.lineTotal.toFixed(2)}
                  {showLineCost && line.lineCost != null
                    ? ` / COGS ${line.lineCost.toFixed(2)}`
                    : ""}
                  )
                </span>
              )}
            </li>
          ))}
          {remaining > 0 && (
            <li className="text-muted-foreground">+{remaining} more line items</li>
          )}
        </ul>
      )}
      {shown.length === 0 && point.count > 0 && (
        <p className="mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          No line-item details for this {countLabel.toLowerCase()} period.
        </p>
      )}
      {details.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {itemLabel} · {partyLabel} per line · click to keep open
        </p>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [selectedKind, setSelectedKind] = useState<ReportKind>("profit");
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [from, setFrom] = useState(defaultCustomFrom);
  const [to, setTo] = useState(defaultCustomTo);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [pinnedAmountIndex, setPinnedAmountIndex] = useState<number | null>(null);
  const [pinnedCountIndex, setPinnedCountIndex] = useState<number | null>(null);

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const showServicesReport = hasFeature(selectedBusiness?.type, "services");
  const showProductionReport = hasFeature(selectedBusiness?.type, "manufacturing");

  const kind = useMemo((): ReportKind => {
    if (selectedKind === "services" && !showServicesReport) return "profit";
    if (
      (selectedKind === "production" || selectedKind === "rawConsumption") &&
      !showProductionReport
    ) {
      return "profit";
    }
    return selectedKind;
  }, [selectedKind, showServicesReport, showProductionReport]);

  const isProfitReport = kind === "profit";

  const fetchReport = useCallback(async (): Promise<ReportResult | null> => {
    if (!businessId) return null;
    const params = new URLSearchParams({
      businessId,
      kind,
      period,
    });
    if (period === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    const res = await fetch(`/api/reports?${params}`);
    const json = await res.json();
    return json.data ?? null;
  }, [businessId, kind, period, from, to]);

  const reloadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReport();
      setReport(data);
      setPinnedAmountIndex(null);
      setPinnedCountIndex(null);
    } finally {
      setLoading(false);
    }
  }, [fetchReport]);

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const data = await fetchReport();
        if (cancelled) return;
        setReport(data);
        setPinnedAmountIndex(null);
        setPinnedCountIndex(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, fetchReport]);

  const displayReport = businessId ? report : null;
  const displayLoading = Boolean(businessId && loading);

  const chartData = useMemo<ChartPoint[]>(
    () =>
      displayReport?.buckets.map((b) => ({
        name: b.label,
        count: b.count,
        total: Math.round(b.total * 100) / 100,
        details: b.details ?? [],
      })) ?? [],
    [displayReport]
  );

  function pinChartIndex(
    label: string | undefined,
    setPinned: React.Dispatch<React.SetStateAction<number | null>>
  ) {
    if (!label) return;
    const index = chartData.findIndex((point) => point.name === label);
    if (index >= 0) setPinned(index);
  }

  function togglePinnedBar(
    index: number | undefined,
    setPinned: React.Dispatch<React.SetStateAction<number | null>>
  ) {
    if (typeof index !== "number") return;
    setPinned((prev) => (prev === index ? null : index));
  }

  const breakdownBuckets = useMemo(
    () => [...(displayReport?.buckets ?? [])].reverse(),
    [displayReport]
  );

  const amountLabel =
    kind === "purchases"
      ? "Spend"
      : kind === "production"
        ? "Units produced"
        : kind === "rawConsumption"
          ? "Material cost"
          : kind === "profit"
            ? "Profit"
            : "Revenue";
  const countLabel =
    kind === "profit"
      ? showServicesReport
        ? "Transactions"
        : "Sales"
      : kind === "sales"
        ? "Sales"
        : kind === "services"
          ? "Bookings"
          : kind === "production"
            ? "Production runs"
            : kind === "rawConsumption"
              ? "Material usages"
              : "Purchases";
  const itemLabel =
    kind === "services"
      ? "Service"
      : kind === "production"
        ? "Finished product"
        : kind === "rawConsumption"
          ? "Raw material"
          : "Product";

  const formatAmountTotal = (value: number) =>
    kind === "production" ? formatQuantity(value) : value.toFixed(2);

  const paymentSplit = useMemo(() => {
    const breakdown = displayReport?.paymentBreakdown ?? [];
    const cash = breakdown.find((b) => b.method === "CASH");
    const online = breakdown.find((b) => b.method === "ONLINE");
    const collected = displayReport?.totalCollected ?? 0;
    const pct = (v: number) => (collected > 0 ? (v / collected) * 100 : 0);
    return {
      collected,
      cash: { amount: cash?.amount ?? 0, count: cash?.count ?? 0 },
      online: { amount: online?.amount ?? 0, count: online?.count ?? 0 },
      cashPct: pct(cash?.amount ?? 0),
      onlinePct: pct(online?.amount ?? 0),
    };
  }, [displayReport]);

  const profitBreakdownCols = isProfitReport
    ? showServicesReport
      ? 7
      : 5
    : 3;

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reports</h2>
        <p className="text-muted-foreground">
          Profit from product sales and services, plus operational analytics for{" "}
          <span className="font-medium text-foreground">
            {selectedBusiness?.name}
          </span>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "profit" as const, label: "Profit" },
            { id: "sales" as const, label: "Product sales" },
            ...(showServicesReport
              ? [{ id: "services" as const, label: "Service revenue" }]
              : []),
            ...(showProductionReport
              ? [
                  { id: "production" as const, label: "Production volume" },
                  { id: "rawConsumption" as const, label: "Raw consumption" },
                ]
              : []),
            { id: "purchases" as const, label: "Purchases" },
          ] as const
        ).map((k) => (
          <Button
            key={k.id}
            variant={kind === k.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedKind(k.id)}
          >
            {k.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            variant={period === p.id ? "secondary" : "outline"}
            size="sm"
            onClick={() => setPeriod(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-4 rounded-md border p-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button onClick={() => void reloadReport()}>Apply range</Button>
        </div>
      )}

      {isProfitReport && (
        <p className="text-sm text-muted-foreground">
          Profit = product sales revenue − cost of goods sold
          {showServicesReport ? " + service booking revenue" : ""}. Purchases
          are inventory investment, not period profit.
          {displayReport && (
            <>
              {" "}
              Totals cover{" "}
              {formatDateYmd(displayReport.from)} —{" "}
              {formatDateYmd(displayReport.to)}
              {period !== "custom" && reportPeriodBreakdownHint(period)
                ? ` (chart broken down ${reportPeriodBreakdownHint(period)}).`
                : "."}
            </>
          )}
        </p>
      )}

      <div
        className={cn(
          "grid gap-4",
          isProfitReport
            ? showServicesReport
              ? "sm:grid-cols-2 xl:grid-cols-5"
              : "sm:grid-cols-2 xl:grid-cols-4"
            : "md:grid-cols-2"
        )}
      >
        {isProfitReport ? (
          <>
            <Card className="border-primary/25 bg-primary/5 sm:col-span-2 xl:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total profit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-3xl font-semibold font-mono tabular-nums",
                    !displayLoading &&
                      (displayReport?.totalAmount ?? 0) < 0 &&
                      "text-destructive"
                  )}
                >
                  {displayLoading
                    ? "…"
                    : (displayReport?.totalAmount ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Product revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold font-mono tabular-nums">
                  {displayLoading
                    ? "…"
                    : (displayReport?.productRevenue ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            {showServicesReport && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Service revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold font-mono tabular-nums">
                    {displayLoading
                      ? "…"
                      : (displayReport?.serviceRevenue ?? 0).toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  COGS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold font-mono tabular-nums">
                  {displayLoading
                    ? "…"
                    : (displayReport?.totalCost ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {showServicesReport ? "Sales + bookings" : "Product sales"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {displayLoading ? "…" : (displayReport?.totalCount ?? 0)}
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total {countLabel.toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {displayLoading ? "…" : (displayReport?.totalCount ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total {amountLabel.toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {displayLoading ? "…" : formatAmountTotal(displayReport?.totalAmount ?? 0)}
            </p>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {(kind === "sales" || kind === "services") && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cash vs Online collected
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {kind === "sales"
                ? "Actual payments received in range, including credit settlements."
                : "Amount collected at booking time (down-payments on credit bookings)."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">
                Total collected
              </span>
              <span className="font-mono text-2xl font-semibold">
                {displayLoading ? "…" : paymentSplit.collected.toFixed(2)}
              </span>
            </div>

            {/* Proportion bar */}
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="bg-chart-1 transition-all"
                style={{ width: `${paymentSplit.cashPct}%` }}
                title={`Cash ${paymentSplit.cashPct.toFixed(0)}%`}
              />
              <div
                className="bg-chart-2 transition-all"
                style={{ width: `${paymentSplit.onlinePct}%` }}
                title={`Online ${paymentSplit.onlinePct.toFixed(0)}%`}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    label: "Cash",
                    data: paymentSplit.cash,
                    pct: paymentSplit.cashPct,
                    dot: "bg-chart-1",
                  },
                  {
                    label: "Online",
                    data: paymentSplit.online,
                    pct: paymentSplit.onlinePct,
                    dot: "bg-chart-2",
                  },
                ] as const
              ).map(({ label, data, pct, dot }) => (
                <div
                  key={label}
                  className="rounded-lg border border-border/60 bg-card p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", dot)} />
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-xl font-semibold">
                    {displayLoading ? "…" : data.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.count} payment{data.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{amountLabel} over time</CardTitle>
          </CardHeader>
          <CardContent>
            {displayLoading ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Loading chart…
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No data in range.
              </div>
            ) : (
              <ReportChartFrame>
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={(state) =>
                    togglePinnedBar(
                      tooltipIndexNumber(state?.activeTooltipIndex),
                      setPinnedAmountIndex
                    )
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    active={pinnedAmountIndex !== null ? true : undefined}
                    defaultIndex={pinnedAmountIndex ?? undefined}
                    wrapperStyle={{ pointerEvents: "auto" }}
                    content={(props) => (
                      <ReportChartTooltip
                        active={props.active}
                        payload={props.payload}
                        label={props.label}
                        kind={kind}
                        amountLabel={amountLabel}
                        countLabel={countLabel}
                        itemLabel={itemLabel}
                        onKeepOpen={() =>
                          pinChartIndex(
                            typeof props.label === "string"
                              ? props.label
                              : undefined,
                            setPinnedAmountIndex
                          )
                        }
                      />
                    )}
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name={amountLabel}
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ReportChartFrame>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>{countLabel} count over time</CardTitle>
          </CardHeader>
          <CardContent>
            {displayLoading ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Loading chart…
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No data in range.
              </div>
            ) : (
              <ReportChartFrame>
                <LineChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={(state) =>
                    togglePinnedBar(
                      tooltipIndexNumber(state?.activeTooltipIndex),
                      setPinnedCountIndex
                    )
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    active={pinnedCountIndex !== null ? true : undefined}
                    defaultIndex={pinnedCountIndex ?? undefined}
                    wrapperStyle={{ pointerEvents: "auto" }}
                    content={(props) => (
                      <ReportChartTooltip
                        active={props.active}
                        payload={props.payload}
                        label={props.label}
                        kind={kind}
                        amountLabel={amountLabel}
                        countLabel={countLabel}
                        itemLabel={itemLabel}
                        onKeepOpen={() =>
                          pinChartIndex(
                            typeof props.label === "string"
                              ? props.label
                              : undefined,
                            setPinnedCountIndex
                          )
                        }
                      />
                    )}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name={countLabel}
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ReportChartFrame>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
          {displayReport && (
            <p className="text-sm text-muted-foreground">
              {formatDateYmd(displayReport.from)} —{" "}
              {formatDateYmd(displayReport.to)}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[36rem] text-xs md:min-w-0 md:text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  {isProfitReport && showServicesReport ? (
                    <>
                      <TableHead className="text-right">Sales</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                    </>
                  ) : (
                    <TableHead className="text-right">Count</TableHead>
                  )}
                  {isProfitReport && (
                    <>
                      <TableHead className="text-right">Product rev.</TableHead>
                      {showServicesReport && (
                        <TableHead className="text-right">Service rev.</TableHead>
                      )}
                      <TableHead className="text-right">COGS</TableHead>
                    </>
                  )}
                  <TableHead className="text-right">{amountLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell
                      colSpan={profitBreakdownCols}
                      className="text-center text-muted-foreground"
                    >
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  breakdownBuckets.map((b) => (
                    <TableRow
                      key={b.date}
                      className={cn(b.count === 0 && "text-muted-foreground")}
                    >
                      <TableCell className="whitespace-normal">{b.label}</TableCell>
                      {isProfitReport && showServicesReport ? (
                        <>
                          <TableCell className="text-right">
                            {b.productCount ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {b.serviceCount ?? 0}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="text-right">{b.count}</TableCell>
                      )}
                      {isProfitReport && (
                        <>
                          <TableCell className="text-right font-mono">
                            {(b.productRevenue ?? 0).toFixed(2)}
                          </TableCell>
                          {showServicesReport && (
                            <TableCell className="text-right font-mono">
                              {(b.serviceRevenue ?? 0).toFixed(2)}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-mono">
                            {(b.cost ?? 0).toFixed(2)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-right font-mono">
                        {formatAmountTotal(b.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && displayReport && breakdownBuckets.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={profitBreakdownCols}
                      className="text-center text-muted-foreground"
                    >
                      No {countLabel.toLowerCase()} in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
