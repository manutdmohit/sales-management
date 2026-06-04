"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  paginationRange,
  type PaginationMeta,
} from "@/lib/pagination";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSizeOption,
} from "@/domain/table-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PaginationProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  pageSize: TablePageSizeOption;
  onPageSizeChange: (size: TablePageSizeOption) => void;
  className?: string;
};

export function Pagination({
  meta,
  onPageChange,
  pageSize,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const { page, totalPages, total } = meta;
  const { from, to } = paginationRange(page, meta.pageSize, total);

  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t bg-muted/30 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <p className="text-center text-muted-foreground sm:text-left">
        <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center justify-center gap-2">
          <Label
            htmlFor="page-size"
            className="sr-only sm:not-sr-only sm:text-muted-foreground"
          >
            Rows per page
          </Label>
          <select
            id="page-size"
            className="h-9 min-h-9 flex-1 cursor-pointer rounded-md border bg-background px-2 text-sm sm:h-8 sm:min-h-8 sm:flex-none"
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as TablePageSizeOption)
            }
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 touch-manipulation sm:min-h-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <span className="min-w-[4.5rem] px-2 text-center tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 touch-manipulation sm:min-h-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
