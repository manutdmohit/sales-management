"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { MAGIC_TOUCH_BRAND } from "@/domain/brand";
import { BusinessLogo } from "@/components/layout/business-logo";
import { toast } from "sonner";
import { staffHomePath } from "@/domain/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [successPulse, setSuccessPulse] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Login failed");
      }
      setSuccessPulse(true);
      toast.success(`Welcome back, ${json.data.user.name}`);
      const role = json.data.user.role as string | undefined;
      const from = searchParams.get("from");
      let target = from || "/";
      if (role === "STAFF") {
        const allowed =
          from?.startsWith("/pos") || from?.startsWith("/bookings");
        target = allowed && from ? from : staffHomePath();
      }
      setTimeout(() => {
        router.push(target);
        router.refresh();
      }, 450);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <Card
      className={`auth-card-enter w-full max-w-md border-border/60 bg-card shadow-xl transition-transform duration-500 ${
        successPulse ? "scale-[0.98] opacity-90" : ""
      }`}
    >
      <CardHeader className="auth-stagger-1 space-y-3 text-center opacity-0">
        <div className="mx-auto">
          <BusinessLogo
            logoUrl={MAGIC_TOUCH_BRAND.logoUrl}
            name={MAGIC_TOUCH_BRAND.name}
            size="lg"
            className="mx-auto"
          />
        </div>
        <CardTitle className="text-2xl">{MAGIC_TOUCH_BRAND.name}</CardTitle>
        <CardDescription className="text-balance">
          {MAGIC_TOUCH_BRAND.address}
        </CardDescription>
      </CardHeader>
      <CardContent className="auth-stagger-2 opacity-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="pl-9 transition-shadow focus:shadow-md"
                placeholder="admin@inventory.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="pl-9 transition-shadow focus:shadow-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
        <p className="auth-stagger-3 mt-4 text-center text-xs text-muted-foreground opacity-0">
          Admin: <code className="text-foreground">admin@inventory.local</code> /{" "}
          <code className="text-foreground">admin123</code>
          <br />
          Staff: <code className="text-foreground">staff@inventory.local</code> /{" "}
          <code className="text-foreground">staff123</code>
        </p>
      </CardContent>
    </Card>
  );
}
