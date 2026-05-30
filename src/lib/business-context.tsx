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

const STORAGE_KEY = "inventory-platform:businessId";

type BusinessContextValue = {
  businesses: Business[];
  businessId: string | null;
  setBusinessId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/businesses");
    const json = await res.json();
    const list: Business[] = json.data ?? [];
    setBusinesses(list);
    if (list.length > 0) {
      const stored =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const valid = list.find((b) => b._id === stored);
      setBusinessIdState(valid?._id ?? list[0]._id);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const setBusinessId = useCallback((id: string) => {
    setBusinessIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
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
