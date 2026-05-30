"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmVariant = "default" | "warning" | "destructive";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Show a brief toast when the user cancels */
  cancelToast?: string;
};

type ConfirmState = ConfirmOptions & { open: boolean };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  const finish = useCallback((result: boolean, options?: ConfirmOptions) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
    if (!result && options?.cancelToast) {
      toast.info(options.cancelToast);
    }
  }, []);

  const variant = state?.variant ?? "default";
  const Icon =
    variant === "destructive" || variant === "warning"
      ? AlertTriangle
      : HelpCircle;

  const iconClass =
    variant === "destructive"
      ? "bg-destructive/10 text-destructive"
      : variant === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-primary/10 text-primary";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog
        open={state?.open ?? false}
        onOpenChange={(open) => {
          if (!open && state) finish(false, state);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClass}`}
              >
                <Icon className="size-5" />
              </div>
              <div className="space-y-2">
                <AlertDialogTitle>{state?.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {state?.description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => state && finish(false, state)}
            >
              {state?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              type="button"
              variant={variant === "destructive" ? "destructive" : "default"}
              onClick={() => state && finish(true, state)}
            >
              {state?.confirmLabel ?? "Confirm"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
