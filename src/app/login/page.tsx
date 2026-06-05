import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { Toaster } from "@/components/ui/sonner";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Suspense
          fallback={
            <div className="h-80 animate-pulse rounded-xl border bg-card" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
      <Toaster />
    </div>
  );
}
