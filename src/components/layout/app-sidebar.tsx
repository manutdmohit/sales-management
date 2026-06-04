"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  BarChart3,
  Building2,
  Settings,
  Scissors,
  CalendarClock,
  Receipt,
  CalendarDays,
  Users,
  Factory,
  Menu,
  Hammer,
  History,
} from "lucide-react";
import { BusinessLogo } from "@/components/layout/business-logo";
import { cn } from "@/lib/utils";
import { useBusiness } from "@/lib/business-context";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/domain/roles";
import { getCapabilities, type Feature } from "@/domain/capabilities";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature?: Feature;
};

const adminLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart, feature: "pos" },
  { href: "/inventory", label: "Inventory", icon: Boxes, feature: "inventory" },
  { href: "/products", label: "Products", icon: Package, feature: "products" },
  { href: "/services", label: "Services", icon: Scissors, feature: "services" },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarClock,
    feature: "appointments",
  },
  {
    href: "/bookings",
    label: "Client bookings",
    icon: CalendarDays,
    feature: "appointments",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    feature: "clients",
  },
  {
    href: "/sales",
    label: "Sales & bookings",
    icon: History,
    feature: "pos",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: Factory,
    feature: "purchases",
  },
  {
    href: "/purchases",
    label: "Purchases",
    icon: Truck,
    feature: "purchases",
  },
  {
    href: "/manufacturing",
    label: "Manufacturing",
    icon: Hammer,
    feature: "manufacturing",
  },
  {
    href: "/receivables",
    label: "Receivables",
    icon: Receipt,
    feature: "receivables",
  },
  { href: "/reports", label: "Reports", icon: BarChart3, feature: "reports" },
];

const staffLinks: NavLink[] = [
  { href: "/pos", label: "POS", icon: ShoppingCart, feature: "pos" },
  {
    href: "/sales",
    label: "Sales & bookings",
    icon: History,
    feature: "pos",
  },
  {
    href: "/bookings",
    label: "Client bookings",
    icon: CalendarDays,
    feature: "appointments",
  },
  {
    href: "/clients",
    label: "Clients",
    icon: Users,
    feature: "clients",
  },
];

const adminSectionLinks: NavLink[] = [
  { href: "/admin/businesses", label: "Businesses", icon: Building2 },
  { href: "/admin/team", label: "Team", icon: Users },
  { href: "/admin/settings", label: "Table settings", icon: Settings },
];

function useVisibleLinks() {
  const { user } = useAuth();
  const { businesses, businessId } = useBusiness();

  const currentBusiness = businesses.find((b) => b._id === businessId);
  const capabilities = currentBusiness
    ? getCapabilities(currentBusiness.type)
    : null;

  const userIsAdmin = Boolean(user && isAdmin(user.role));
  const baseLinks = userIsAdmin ? adminLinks : staffLinks;
  const visibleLinks = baseLinks.filter(
    (link) =>
      !link.feature || !capabilities || capabilities.includes(link.feature)
  );

  return { visibleLinks, userIsAdmin };
}

function SidebarBrand() {
  const { businesses, businessId } = useBusiness();
  const business = businesses.find((b) => b._id === businessId);
  const name = business?.name ?? "Inventory";
  const logoUrl = business?.settings?.logoUrl;
  const address = business?.settings?.address;

  return (
    <div className="border-b border-sidebar-border px-4 py-5">
      <div className="flex items-start gap-3">
        <Link
          href="/"
          className="shrink-0 rounded-xl ring-offset-sidebar transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="Go to dashboard"
        >
          <BusinessLogo logoUrl={logoUrl} name={name} size="md" />
        </Link>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-semibold text-sidebar-foreground">
            {name}
          </h1>
          {address ? (
            <p className="mt-1 line-clamp-2 text-[0.65rem] leading-snug text-sidebar-foreground/55">
              {address}
            </p>
          ) : (
            <p className="mt-0.5 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-sidebar-foreground/45">
              Inventory platform
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { visibleLinks, userIsAdmin } = useVisibleLinks();

  const renderLink = ({ href, label, icon: Icon }: NavLink, exact = false) => {
    const active = exact ? pathname === href : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          active
            ? "brand-gradient text-white shadow-sm shadow-primary/40"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white/80" />
        )}
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            !active && "group-hover:scale-110"
          )}
        />
        {label}
      </Link>
    );
  };

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {visibleLinks.map((link) => renderLink(link, link.href === "/"))}
      {userIsAdmin && (
        <>
          <p className="mt-5 mb-1 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
            Admin
          </p>
          {adminSectionLinks.map((link) => renderLink(link))}
        </>
      )}
    </nav>
  );
}

/** Desktop sidebar — hidden below the `lg` breakpoint. */
export function AppSidebar() {
  return (
    <aside className="hidden min-h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  );
}

/** Mobile hamburger + slide-in drawer — shown only below the `lg` breakpoint. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="shrink-0 lg:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-72 max-w-[82vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBrand />
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
