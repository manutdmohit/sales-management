"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchList } from "@/lib/fetch-list";
import type { PaginationMeta } from "@/lib/pagination";
import { useTableSettings } from "@/lib/table-settings-context";

export function usePaginatedList<T>(
  buildUrl: (page: number, pageSize: number) => string | null,
  resetDeps: unknown[] = []
) {
  const { pageSize, loading: settingsLoading } = useTableSettings();
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const enabled = buildUrl(1, pageSize) !== null;

  const load = useCallback(async () => {
    const url = buildUrl(page, pageSize);
    if (!url) {
      setItems([]);
      setMeta(null);
      return;
    }
    const { items: nextItems, meta: nextMeta } = await fetchList<T>(url);
    setItems(nextItems);
    setMeta(nextMeta);
  }, [buildUrl, page, pageSize]);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when deps change
  }, [pageSize, ...resetDeps]);

  useEffect(() => {
    if (settingsLoading) return;
    if (!enabled) {
      setItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load, settingsLoading, enabled]);

  return {
    items,
    meta,
    page,
    setPage,
    pageSize,
    loading: loading || settingsLoading,
    reload: load,
    enabled,
  };
}
