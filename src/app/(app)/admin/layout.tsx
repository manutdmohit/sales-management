import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-8">
      <AdminNav />
      {children}
    </div>
  );
}
