import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function MobileFilterPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/50 bg-card/90 p-3 shadow-sm ring-1 ring-foreground/3 sm:p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function MobileSearchField({
  id = "list-search",
  placeholder,
  value,
  onChange,
  onPageReset,
  className,
}: {
  id?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onPageReset?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0 flex-1", className)}>
      <Label htmlFor={id} className="sr-only">
        Search
      </Label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onPageReset?.();
        }}
        className="h-11 pl-9 text-base sm:text-sm"
      />
    </div>
  );
}

export function ListPageHeader({
  title,
  description,
  descriptionMobile,
  actions,
}: {
  title: string;
  description?: ReactNode;
  descriptionMobile?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h2>
        {descriptionMobile && (
          <p className="text-sm text-muted-foreground sm:hidden">
            {descriptionMobile}
          </p>
        )}
        {description && (
          <p
            className={cn(
              "text-sm text-muted-foreground",
              descriptionMobile && "hidden sm:block"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap [&>*]:min-h-10 [&>*]:touch-manipulation">
          {actions}
        </div>
      )}
    </div>
  );
}
