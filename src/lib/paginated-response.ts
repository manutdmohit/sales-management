import { NextResponse } from "next/server";
import type { PaginatedResult } from "@/lib/pagination";

export function isPaginatedResult<T>(
  value: T[] | PaginatedResult<T>
): value is PaginatedResult<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    "meta" in value
  );
}

export function jsonListResponse<T>(value: T[] | PaginatedResult<T>) {
  if (isPaginatedResult(value)) {
    return NextResponse.json({ data: value.items, meta: value.meta });
  }
  return NextResponse.json({ data: value });
}
