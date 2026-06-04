import {
  clampTablePageSize,
  DEFAULT_TABLE_PAGE_SIZE,
} from "@/domain/table-settings";

export const DEFAULT_PAGE_SIZE = DEFAULT_TABLE_PAGE_SIZE;
export const MAX_PAGE_SIZE = 100;

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    meta: {
      total,
      page,
      pageSize,
      totalPages,
    },
  };
}

export function parsePaginationParams(
  searchParams: URLSearchParams
): { page: number; pageSize: number; skip: number } | null {
  const pageParam = searchParams.get("page");
  if (pageParam === null) return null;

  const page = Math.max(1, parseInt(pageParam, 10) || 1);
  const rawSize = parseInt(searchParams.get("pageSize") ?? "", 10);
  const pageSize = Number.isNaN(rawSize)
    ? DEFAULT_PAGE_SIZE
    : clampTablePageSize(rawSize);
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

export type SortDir = "asc" | "desc";

/**
 * Parse `sort` / `dir` query params, restricting `sort` to an allow-list of
 * fields. Falls back to the provided default when missing or not permitted.
 */
export function parseSortParams(
  searchParams: URLSearchParams,
  allowed: readonly string[],
  fallback: { sort: string; dir: SortDir }
): { sort: string; dir: SortDir } {
  const sortParam = searchParams.get("sort");
  const sort =
    sortParam && allowed.includes(sortParam) ? sortParam : fallback.sort;
  const dirParam = searchParams.get("dir");
  const dir: SortDir =
    dirParam === "asc" || dirParam === "desc" ? dirParam : fallback.dir;
  return { sort, dir };
}

/** Build a Mongo sort object from a field + direction, with optional tiebreaker. */
export function mongoSort(
  sort: string,
  dir: SortDir,
  secondary?: Record<string, 1 | -1>
): Record<string, 1 | -1> {
  return { [sort]: dir === "asc" ? 1 : -1, ...(secondary ?? {}) };
}

export function paginationRange(
  page: number,
  pageSize: number,
  total: number
): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 };
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return { from, to };
}
