import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BusinessSelector } from "@/components/layout/business-selector";
import { PageTransition } from "@/components/layout/page-transition";
import { UserMenu } from "@/components/layout/user-menu";
import { BusinessProvider } from "@/lib/business-context";
import { AuthProvider } from "@/lib/auth-context";
import { getSession } from "@/lib/auth/session";
import { ConfirmProvider } from "@/components/ui/confirm-provider";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <AuthProvider>
      <ConfirmProvider>
      <BusinessProvider>
        <div className="flex min-h-screen">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <header className="flex h-14 items-center justify-between gap-4 border-b px-6">
              <BusinessSelector />
              <UserMenu />
            </header>
            <main className="flex-1 overflow-auto p-6">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </div>
        <Toaster />
      </BusinessProvider>
      </ConfirmProvider>
    </AuthProvider>
  );
}
