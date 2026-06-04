"use client";

import { Building2 } from "lucide-react";
import { useBusiness } from "@/lib/business-context";
import { businessTypeLabel } from "@/domain/business-types";
import { ButtonLink } from "@/components/ui/button";

export function BusinessSelector() {
  const { businesses, businessId, setBusinessId, loading } = useBusiness();

  if (loading) {
    return (
      <div
        className="h-8 w-full max-w-[8rem] animate-pulse rounded-md bg-muted sm:max-w-[12rem]"
        aria-hidden
      />
    );
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
    <div className="flex h-8 min-w-0 w-full items-center gap-1.5 rounded-lg border border-border/70 bg-card/60 pl-2 pr-0.5 shadow-sm sm:h-9 sm:gap-2 sm:pl-3 sm:pr-1">
      <Building2 className="size-3.5 shrink-0 text-primary sm:size-4" />
      <select
        id="business"
        aria-label="Business"
        className="h-full min-w-0 flex-1 cursor-pointer truncate rounded-md bg-transparent pr-1 text-xs font-medium outline-none sm:pr-2 sm:text-sm"
        value={businessId ?? ""}
        onChange={(e) => setBusinessId(e.target.value)}
      >
        {businesses.map((b) => (
          <option key={b._id} value={b._id}>
            {b.name} ({b.code}) — {businessTypeLabel(b.type)}
          </option>
        ))}
      </select>
    </div>
  );
}
