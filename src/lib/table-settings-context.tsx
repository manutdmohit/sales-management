"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clampTablePageSize,
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSizeOption,
} from "@/domain/table-settings";

type TableSettingsContextValue = {
  pageSize: TablePageSizeOption;
  pageSizeOptions: readonly TablePageSizeOption[];
  loading: boolean;
  setPageSize: (size: TablePageSizeOption) => Promise<void>;
  refresh: () => Promise<void>;
};

const TableSettingsContext = createContext<TableSettingsContextValue | null>(
  null
);

export function TableSettingsProvider({
  children,
  initialPageSize = null,
}: {
  children: ReactNode;
  initialPageSize?: TablePageSizeOption | null;
}) {
  const hasInitial = initialPageSize != null;
  const [pageSize, setPageSizeState] = useState<TablePageSizeOption>(
    initialPageSize ?? DEFAULT_TABLE_PAGE_SIZE
  );
  const [loading, setLoading] = useState(!hasInitial);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/bootstrap");
    const json = await res.json();
    if (res.ok && json.data?.tablePageSize != null) {
      setPageSizeState(clampTablePageSize(json.data.tablePageSize));
    }
  }, []);

  useEffect(() => {
    if (hasInitial) return;
    refresh()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [hasInitial, refresh]);

  const setPageSize = useCallback(
    async (size: TablePageSizeOption) => {
      const next = clampTablePageSize(size);
      setPageSizeState(next);
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTablePageSize: next }),
      });
      if (!res.ok) {
        await refresh();
        throw new Error("Failed to update table settings");
      }
    },
    [refresh]
  );

  return (
    <TableSettingsContext.Provider
      value={{
        pageSize,
        pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
        loading,
        setPageSize,
        refresh,
      }}
    >
      {children}
    </TableSettingsContext.Provider>
  );
}

export function useTableSettings() {
  const ctx = useContext(TableSettingsContext);
  if (!ctx) {
    throw new Error("useTableSettings must be used within TableSettingsProvider");
  }
  return ctx;
}
