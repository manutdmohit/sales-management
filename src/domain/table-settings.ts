export const DEFAULT_TABLE_PAGE_SIZE = 10;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export type TablePageSizeOption = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

export function clampTablePageSize(size: number): TablePageSizeOption {
  const allowed = TABLE_PAGE_SIZE_OPTIONS as readonly number[];
  if (allowed.includes(size)) return size as TablePageSizeOption;
  return DEFAULT_TABLE_PAGE_SIZE;
}
