import type { PaginationMeta } from "@/lib/pagination";

export type ListResponse<T> = {
  items: T[];
  meta: PaginationMeta | null;
};

export async function fetchList<T>(url: string): Promise<ListResponse<T>> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : "Request failed"
    );
  }
  return {
    items: (json.data ?? []) as T[],
    meta: json.meta ?? null,
  };
}
