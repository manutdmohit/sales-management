"use client";

import { useBusiness } from "@/lib/business-context";
import { BUSINESS_TYPE_LABELS } from "@/domain/business-types";
import { Label } from "@/components/ui/label";
import { Button, ButtonLink } from "@/components/ui/button";

export function BusinessSelector() {
  const { businesses, businessId, setBusinessId, loading } = useBusiness();

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading businesses…</p>;
  }

  if (businesses.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <p className="text-sm text-amber-600">No businesses yet.</p>
        <ButtonLink href="/admin/businesses" size="sm" variant="outline">
          Add business
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="business" className="text-sm text-muted-foreground">
        Business
      </Label>
      <select
        id="business"
        className="h-9 rounded-md border bg-background px-3 text-sm"
        value={businessId ?? ""}
        onChange={(e) => setBusinessId(e.target.value)}
      >
        {businesses.map((b) => (
          <option key={b._id} value={b._id}>
            {b.name} ({b.code}) — {BUSINESS_TYPE_LABELS[b.type]}
          </option>
        ))}
      </select>
    </div>
  );
}
