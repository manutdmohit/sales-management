import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileCardShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm ring-1 ring-foreground/3",
        className
      )}
    >
      {children}
    </article>
  );
}

export function MobileCardHeader({
  title,
  subtitle,
  badge,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-4 pb-3 pt-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-snug tracking-tight">
          {title}
        </div>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
    </div>
  );
}

export function MobileCardMetrics({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    highlight?: boolean;
  }[];
}) {
  return (
    <div
      className={cn(
        "grid divide-x divide-border/40 border-y border-border/40 bg-muted/20",
        items.length === 1 ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.label}
          </p>
          <p
            className={cn(
              "mt-1 font-mono tabular-nums tracking-tight",
              item.highlight ? "text-2xl font-semibold" : "text-lg font-semibold"
            )}
          >
            {item.value}
          </p>
          {item.sub && (
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MobileCardDetails({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs">{children}</div>
  );
}

export function MobileCardDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}

export function MobileCardFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border/40 bg-muted/10 px-3 py-2.5">
      {children}
    </div>
  );
}

export function MobileCardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-3 text-sm text-muted-foreground", className)}>
      {children}
    </div>
  );
}
