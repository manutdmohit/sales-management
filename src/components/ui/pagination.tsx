"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { paginationRange, type PaginationMeta } from "@/lib/pagination";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  className?: string;
};

export function Pagination({ meta, onPageChange, className }: PaginationProps) {
  const { page, totalPages, total, pageSize } = meta;
  const { from, to } = paginationRange(page, pageSize, total);

  if (total === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm ${className ?? ""}`}
    >
      <p className="text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="min-w-[5rem] px-2 text-center tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
