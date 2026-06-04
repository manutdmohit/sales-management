"use client";

import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { formatDateYmd } from "@/lib/format-datetime";
import { formatQuantity, formatQuantityWithUnit, roundQuantity } from "@/lib/format-quantity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  Package,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  BarChart3,
  Truck,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import type { StockSummary } from "@/domain/types";
import type { ReportPeriod } from "@/lib/report-ranges";
import { REPORT_PERIOD_OPTIONS } from "@/lib/report-ranges";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ExpiryAlertRow = {
  _id: string;
  productName: string;
  sku: string;
  batchNumber: string;
  remainingQuantity: number;
  unitId?: string;
  expiryDate: string;
  level: "warning" | "critical";
};

type ProfitSnapshot = {
  total: number;
  from?: string;
  to?: string;
};

export default function DashboardPage() {
  const { businessId } = useBusiness();
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [lowStock, setLowStock] = useState(0);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertRow[]>([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [profitPeriod, setProfitPeriod] = useState<ReportPeriod>("daily");
  const [profitSnapshot, setProfitSnapshot] = useState<ProfitSnapshot | null>(
    null
  );
  const [profitLoading, setProfitLoading] = useState(false);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/inventory?businessId=${businessId}`)
      .then((r) => r.json())
      .then((json) => {
        const data: StockSummary[] = json.data ?? [];
        setSummary(data);
        setLowStock(data.filter((s) => s.isLowStock).length);
      });
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setExpiryAlerts([]);
      return;
    }
    setExpiryLoading(true);
    fetch(`/api/inventory/expiring?businessId=${businessId}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((json) => setExpiryAlerts(json.data ?? []))
      .catch(() => setExpiryAlerts([]))
      .finally(() => setExpiryLoading(false));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setProfitSnapshot(null);
      return;
    }
    setProfitLoading(true);
    fetch(
      `/api/reports?businessId=${businessId}&kind=profit&period=${profitPeriod}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((json) => {
        const data = json.data;
        setProfitSnapshot({
          total: data?.totalAmount ?? 0,
          from: data?.from,
          to: data?.to,
        });
      })
      .catch(() => setProfitSnapshot(null))
      .finally(() => setProfitLoading(false));
  }, [businessId, profitPeriod]);

  const profitPeriodMeta = REPORT_PERIOD_OPTIONS.find(
    (p) => p.id === profitPeriod
  );

  const totalProducts = summary.length;
  const totalUnits = roundQuantity(
    summary.reduce((a, s) => a + s.stock, 0)
  );
  const lowStockItems = summary.filter((s) => s.isLowStock);
  const expiredCount = expiryAlerts.filter((a) => a.level === "critical").length;
  const expiringSoonCount = expiryAlerts.filter((a) => a.level === "warning").length;

  const stats: {
    label: string;
    value: string | number;
    icon: typeof Package;
    tint: string;
  }[] = [
    {
      label: "Products",
      value: totalProducts,
      icon: Package,
      tint: "bg-chart-1/10 text-chart-1",
    },
    {
      label: "Total units in stock",
      value: formatQuantity(totalUnits),
      icon: Boxes,
      tint: "bg-chart-2/10 text-chart-2",
    },
    {
      label: "Low stock alerts",
      value: lowStock,
      icon: AlertTriangle,
      tint: "bg-destructive/10 text-destructive",
    },
    {
      label: "Expiry alerts",
      value: expiryLoading ? "…" : expiryAlerts.length,
      icon: CalendarClock,
      tint: "bg-chart-3/10 text-chart-3",
    },
  ];

  const quickLinks = [
    { href: "/pos", label: "Open POS", icon: ShoppingCart },
    { href: "/purchases", label: "Record purchase", icon: Truck },
    { href: "/reports", label: "View reports", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-gradient sm:text-3xl">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Ledger-based inventory — stock is calculated from transactions.
        </p>
      </div>

      <Card className="card-elevated border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardDescription>
              Profit · {profitPeriodMeta?.shortLabel ?? "selected period"}
            </CardDescription>
            <CardTitle
              className={cn(
                "font-mono text-3xl tabular-nums sm:text-4xl",
                !profitLoading &&
                  profitSnapshot != null &&
                  profitSnapshot.total < 0 &&
                  "text-destructive"
              )}
            >
              {profitLoading || profitSnapshot == null
                ? "…"
                : profitSnapshot.total.toFixed(2)}
            </CardTitle>
            {profitSnapshot?.from && profitSnapshot?.to && (
              <p className="text-xs text-muted-foreground">
                {formatDateYmd(profitSnapshot.from)} —{" "}
                {formatDateYmd(profitSnapshot.to)}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Product sales revenue − COGS + service revenue
            </p>
          </div>
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:order-last">
            <TrendingUp className="size-5" />
          </div>
          <div className="flex flex-wrap gap-1.5 sm:col-span-2 sm:w-full">
            {REPORT_PERIOD_OPTIONS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={profitPeriod === p.id ? "default" : "outline"}
                size="sm"
                className="h-8 touch-manipulation"
                onClick={() => setProfitPeriod(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ButtonLink href="/reports" variant="outline" size="sm">
            Full profit report
          </ButtonLink>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint }) => (
          <Card key={label} className="card-elevated card-hover border-0">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardDescription>{label}</CardDescription>
                <CardTitle className="text-2xl tabular-nums sm:text-3xl">
                  {value}
                </CardTitle>
              </div>
              <div
                className={`flex size-10 items-center justify-center rounded-xl sm:size-11 ${tint}`}
              >
                <Icon className="size-5" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="card-elevated border-0">
          <CardHeader>
            <CardTitle>Quick inventory</CardTitle>
            <CardDescription>Top items by stock level</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="-mx-2 divide-y divide-border/60">
              {summary.slice(0, 8).map((s) => (
                <li
                  key={s.productId}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0 font-medium">
                    {s.productName}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({s.sku})
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {s.isLowStock && <Badge variant="destructive">Low</Badge>}
                    <span className="font-mono tabular-nums font-medium">
                      {formatQuantityWithUnit(s.stock, s.unitId)}
                    </span>
                  </span>
                </li>
              ))}
              {summary.length === 0 && (
                <p className="px-2 text-sm text-muted-foreground">
                  No inventory data. Add products and record a purchase.
                </p>
              )}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="card-elevated border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {quickLinks.map(({ href, label, icon: Icon }) => (
                <ButtonLink
                  key={href}
                  href={href}
                  variant="outline"
                  className="h-10 w-full justify-start touch-manipulation"
                >
                  <Icon className="size-4" />
                  {label}
                </ButtonLink>
              ))}
            </CardContent>
          </Card>

          {lowStockItems.length > 0 && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">
                  Needs restock
                </CardTitle>
                <CardDescription>
                  {lowStockItems.length} item
                  {lowStockItems.length === 1 ? "" : "s"} below minimum
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {lowStockItems.slice(0, 5).map((s) => (
                    <li key={s.productId} className="flex justify-between gap-2">
                      <span className="truncate">{s.productName}</span>
                      <span className="shrink-0 font-mono tabular-nums">
                        {formatQuantityWithUnit(s.stock, s.unitId)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="border-chart-3/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-chart-3" />
                Expiring products
              </CardTitle>
              <CardDescription>
                {expiryLoading
                  ? "Checking batches…"
                  : expiryAlerts.length === 0
                    ? "No batches expiring within 30 days"
                    : [
                        expiredCount > 0 && `${expiredCount} expired`,
                        expiringSoonCount > 0 &&
                          `${expiringSoonCount} expiring soon`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!expiryLoading && expiryAlerts.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {expiryAlerts.slice(0, 5).map((row) => (
                    <li
                      key={row._id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.productName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Batch {row.batchNumber} ·{" "}
                          {formatQuantityWithUnit(
                            row.remainingQuantity,
                            row.unitId
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatDateYmd(row.expiryDate)}
                        </span>
                        <Badge
                          variant={
                            row.level === "critical" ? "destructive" : "outline"
                          }
                          className="text-[10px]"
                        >
                          {row.level === "critical" ? "Expired" : "Soon"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <ButtonLink
                href="/inventory"
                variant="outline"
                size="sm"
                className="h-9 w-full touch-manipulation"
              >
                View inventory
              </ButtonLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
