import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

import { Toaster } from "@/components/ui/sonner";

export default function LoginPage() {
  return (
    <div className="auth-page-bg relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <div className="auth-orb auth-orb-1" aria-hidden />
      <div className="auth-orb auth-orb-2" aria-hidden />
      <div className="auth-orb auth-orb-3" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <p className="auth-stagger-0 mb-6 text-center text-sm font-medium tracking-wide text-muted-foreground uppercase opacity-0">
          Enterprise Inventory v2
        </p>
        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-xl border bg-card/80" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
      <Toaster />
    </div>
  );
}
