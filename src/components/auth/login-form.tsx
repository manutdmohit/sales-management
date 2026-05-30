"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, Package } from "lucide-react";
import { toast } from "sonner";
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
      const from = searchParams.get("from") || "/";
      setTimeout(() => {
        router.push(from);
        router.refresh();
      }, 450);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <Card
      className={`auth-card-enter w-full max-w-md border-border/60 bg-card/90 shadow-xl backdrop-blur-sm transition-transform duration-500 ${
        successPulse ? "scale-[0.98] opacity-90" : ""
      }`}
    >
      <CardHeader className="auth-stagger-1 space-y-3 text-center opacity-0">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <Package className="size-6" />
        </div>
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription>
          Inventory Platform — manage stock, sales, and reports
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
          Default admin: <code className="text-foreground">admin@inventory.local</code>{" "}
          / <code className="text-foreground">admin123</code>
        </p>
      </CardContent>
    </Card>
  );
}
