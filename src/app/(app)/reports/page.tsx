"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { ReportPeriod, ReportResult } from "@/lib/report-ranges";
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

type ReportKind = "sales" | "purchases";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "daily", label: "Daily (30d)" },
  { id: "weekly", label: "Weekly (12w)" },
  { id: "monthly", label: "Monthly (12m)" },
  { id: "custom", label: "Custom range" },
];

function defaultCustomFrom() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultCustomTo() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [kind, setKind] = useState<ReportKind>("sales");
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [from, setFrom] = useState(defaultCustomFrom);
  const [to, setTo] = useState(defaultCustomTo);
  const [report, setReport] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedBusiness = businesses.find((b) => b._id === businessId);

  const loadReport = useCallback(async () => {
    if (!businessId) return;
    const params = new URLSearchParams({
      businessId,
      kind,
      period,
    });
    if (period === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      setReport(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [businessId, kind, period, from, to]);

  useEffect(() => {
    if (!businessId) return;
    void loadReport();
  }, [businessId, loadReport]);

  const displayReport = businessId ? report : null;
  const displayLoading = Boolean(businessId && loading);

  const chartData = useMemo(
    () =>
      displayReport?.buckets.map((b) => ({
        name: b.label,
        count: b.count,
        total: Math.round(b.total * 100) / 100,
      })) ?? [],
    [displayReport]
  );

  const amountLabel = kind === "sales" ? "Revenue" : "Spend";
  const countLabel = kind === "sales" ? "Sales" : "Purchases";

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
          Sales and purchase analytics for{" "}
          <span className="font-medium text-foreground">
            {selectedBusiness?.name}
          </span>
          .
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["sales", "purchases"] as const).map((k) => (
          <Button
            key={k}
            variant={kind === k ? "default" : "outline"}
            size="sm"
            onClick={() => setKind(k)}
          >
            {k === "sales" ? "Sales report" : "Purchase report"}
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
          <Button onClick={loadReport}>Apply range</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
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
              {displayLoading ? "…" : (displayReport?.totalAmount.toFixed(2) ?? "0.00")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{amountLabel} over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {displayLoading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? value.toFixed(2) : value
                    }
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    name={amountLabel}
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{countLabel} count over time</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {displayLoading ? (
              <p className="text-sm text-muted-foreground">Loading chart…</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data in range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
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
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
          {displayReport && (
            <p className="text-sm text-muted-foreground">
              {new Date(displayReport.from).toLocaleDateString()} —{" "}
              {new Date(displayReport.to).toLocaleDateString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">{amountLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  report?.buckets.map((b) => (
                    <TableRow
                      key={b.date}
                      className={cn(b.count === 0 && "text-muted-foreground")}
                    >
                      <TableCell>{b.label}</TableCell>
                      <TableCell className="text-right">{b.count}</TableCell>
                      <TableCell className="text-right font-mono">
                        {b.total.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && report && report.buckets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No {kind} in this period.
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
