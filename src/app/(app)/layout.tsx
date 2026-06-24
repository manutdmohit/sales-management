import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { BootstrapCookieSync } from "@/components/layout/bootstrap-cookie-sync";
import { BusinessSelector } from "@/components/layout/business-selector";
import { PageTransition } from "@/components/layout/page-transition";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { BusinessProvider } from "@/lib/business-context";
import { TableSettingsProvider } from "@/lib/table-settings-context";
import { AuthProvider } from "@/lib/auth-context";
import { BUSINESS_COOKIE } from "@/lib/business-cookie";
import { getSession } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { isAdmin } from "@/domain/roles";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/sonner";
import { bootstrapService } from "@/services/bootstrap.service";
import type { UserRole } from "@/domain/roles";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await connectDb();
  const cookieStore = await cookies();
  const cookieBusinessId = cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
  const bootstrap = await bootstrapService.getForSession(
    session,
    cookieBusinessId
  );

  return (
    <AuthProvider initialUser={{ ...bootstrap.user, role: bootstrap.user.role as UserRole }}>
      <ConfirmProvider>
        <BusinessProvider
          initialBusinesses={bootstrap.businesses}
          initialBusinessId={bootstrap.businessId}
        >
          <TableSettingsProvider initialPageSize={bootstrap.tablePageSize}>
            <BootstrapCookieSync
              businessId={bootstrap.businessId}
              cookieBusinessId={cookieBusinessId}
            />
            <div className="flex min-h-dvh">
              <AppSidebar />
              <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1 border-b border-border/60 bg-background px-3 sm:h-16 sm:gap-2 sm:px-4 lg:gap-4 lg:px-6 lg:bg-background/70 lg:backdrop-blur-xl">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden sm:gap-2">
                    <MobileNav />
                    <div className="min-w-0 flex-1">
                      <BusinessSelector />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                    {isAdmin(session.role) && <NotificationBell />}
                    <UserMenu initialRole={session.role} />
                  </div>
                </header>
                <main className="app-shell-bg min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                  <div className="mx-auto w-full max-w-7xl">
                    <PageTransition>{children}</PageTransition>
                  </div>
                </main>
              </div>
            </div>
            <Toaster />
          </TableSettingsProvider>
        </BusinessProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
