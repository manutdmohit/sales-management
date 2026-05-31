export const DEFAULT_PAGE_SIZE = 20;
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
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isNaN(rawSize) ? DEFAULT_PAGE_SIZE : rawSize)
  );
  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
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
