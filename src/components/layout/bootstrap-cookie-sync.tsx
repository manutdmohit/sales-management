"use client";

import { useEffect, useRef } from "react";

/** Persist the server-resolved business selection for SSR on the next request. */
export function BootstrapCookieSync({
  businessId,
  cookieBusinessId,
}: {
  businessId: string | null;
  cookieBusinessId: string | null;
}) {
  const synced = useRef(false);

  useEffect(() => {
    if (!businessId || synced.current) return;
    if (businessId === cookieBusinessId) {
      synced.current = true;
      return;
    }

    synced.current = true;
    void fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
  }, [businessId, cookieBusinessId]);

  return null;
}
