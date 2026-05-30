"use client";

import { useEffect, useState } from "react";
import { useBusiness } from "@/lib/business-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { StockSummary } from "@/domain/types";

export default function DashboardPage() {
  const { businessId } = useBusiness();
  const [summary, setSummary] = useState<StockSummary[]>([]);
  const [lowStock, setLowStock] = useState(0);

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

  const totalProducts = summary.length;
  const totalUnits = summary.reduce((a, s) => a + s.stock, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Ledger-based inventory — stock is calculated from transactions.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Products</CardDescription>
            <CardTitle className="text-3xl">{totalProducts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total units in stock</CardDescription>
            <CardTitle className="text-3xl">{totalUnits}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Low stock alerts</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{lowStock}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick inventory</CardTitle>
          <CardDescription>Top items by stock level</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {summary.slice(0, 8).map((s) => (
              <li
                key={s.productId}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {s.productName}{" "}
                  <span className="text-muted-foreground">({s.sku})</span>
                </span>
                <span className="flex items-center gap-2">
                  {s.isLowStock && (
                    <Badge variant="destructive">Low</Badge>
                  )}
                  <span className="font-mono">{s.stock}</span>
                </span>
              </li>
            ))}
            {summary.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No inventory data. Add products and record a purchase.
              </p>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
