"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { PaymentReceipt } from "@/domain/types";
import { receiptThumbnailUrl, type ReceiptCategory } from "@/lib/receipt-display";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReceiptUploadProps = {
  businessId: string;
  category: ReceiptCategory;
  value?: PaymentReceipt | null;
  onChange: (receipt: PaymentReceipt | null) => void;
  label?: string;
  hint?: string;
  id?: string;
  className?: string;
  /** Emphasize when online / QR payment is expected. */
  suggested?: boolean;
};

export function ReceiptUpload({
  businessId,
  category,
  value,
  onChange,
  label = "Payment receipt",
  hint = "Upload a photo of the QR or bank payment confirmation (optional).",
  id = "receipt-upload",
  className,
  suggested = false,
}: ReceiptUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File | null) {
    if (!file || !businessId) return;

    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("businessId", businessId);
      form.set("category", category);
      form.set("label", "QR payment");

      const res = await fetch("/api/uploads/receipt", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string" ? json.error : "Upload failed";
        throw new Error(message);
      }
      onChange(json.data as PaymentReceipt);
      toast.success("Receipt uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border border-border/60 p-3",
        suggested && !value && "border-primary/40 bg-primary/5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label htmlFor={id} className="text-sm">
            {label}
            {suggested && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                recommended for online payments
              </span>
            )}
          </Label>
          {hint && (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove receipt"
            onClick={() => onChange(null)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      {value ? (
        <a
          href={value.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-md border bg-muted/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={receiptThumbnailUrl(value.url, 480)}
            alt="Payment receipt"
            className="max-h-48 w-full object-contain"
          />
        </a>
      ) : (
        <div>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            capture="environment"
            className="sr-only"
            disabled={uploading || !businessId}
            onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full touch-manipulation"
            disabled={uploading || !businessId}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <ImagePlus className="size-4" />
                Add receipt photo
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
