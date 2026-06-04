"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Building2, Settings, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { springSmooth } from "@/lib/motion";

const tabs = [
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/settings", label: "Table settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-500">
      <div className="flex items-center gap-3">
        <div className="brand-gradient flex size-11 items-center justify-center rounded-2xl text-white shadow-sm shadow-primary/30">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Admin
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Administration
          </h2>
        </div>
      </div>

      <nav className="inline-flex gap-1 rounded-xl border border-border/60 bg-card/60 p-1 shadow-sm backdrop-blur">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-tab-indicator"
                  transition={springSmooth}
                  className="brand-gradient absolute inset-0 rounded-lg shadow-sm shadow-primary/30"
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
