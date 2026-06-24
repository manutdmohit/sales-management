"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Business } from "@/domain/types";
import { resolveBusinessId } from "@/lib/business-cookie";

const STORAGE_KEY = "inventory-platform:businessId";

type BusinessContextValue = {
  businesses: Business[];
  businessId: string | null;
  setBusinessId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({
  children,
  initialBusinesses = null,
  initialBusinessId = null,
}: {
  children: ReactNode;
  initialBusinesses?: Business[] | null;
  initialBusinessId?: string | null;
}) {
  const hasInitial = initialBusinesses != null;
  const [businesses, setBusinesses] = useState<Business[]>(
    initialBusinesses ?? []
  );
  const [businessId, setBusinessIdState] = useState<string | null>(
    initialBusinessId
  );
  const [loading, setLoading] = useState(!hasInitial);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/bootstrap");
    const json = await res.json();
    const data = json.data;
    const list: Business[] = data?.businesses ?? [];
    setBusinesses(list);
    if (list.length > 0) {
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      setBusinessIdState(
        resolveBusinessId(list, data?.businessId ?? stored)
      );
    } else {
      setBusinessIdState(null);
    }
  }, []);

  useEffect(() => {
    if (hasInitial) return;
    refresh().finally(() => setLoading(false));
  }, [hasInitial, refresh]);

  const setBusinessId = useCallback((id: string) => {
    setBusinessIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    void fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: id }),
    });
  }, []);

  return (
    <BusinessContext.Provider
      value={{ businesses, businessId, setBusinessId, loading, refresh }}
    >
      {children}
    </BusinessContext.Provider>
  );
}

export function useBusiness() {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error("useBusiness must be used within BusinessProvider");
  }
  return ctx;
}
