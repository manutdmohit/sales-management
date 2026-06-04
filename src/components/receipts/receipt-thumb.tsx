import type { PaymentReceipt } from "@/domain/types";
import { receiptThumbnailUrl } from "@/lib/receipt-display";
import { cn } from "@/lib/utils";

type ReceiptThumbProps = {
  receipt: PaymentReceipt;
  className?: string;
  size?: number;
};

export function ReceiptThumb({ receipt, className, size = 56 }: ReceiptThumbProps) {
  return (
    <a
      href={receipt.url}
      target="_blank"
      rel="noopener noreferrer"
      title={receipt.label ?? "View receipt"}
      className={cn(
        "inline-flex shrink-0 overflow-hidden rounded-md border bg-muted/30 hover:ring-2 hover:ring-primary/30",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={receiptThumbnailUrl(receipt.url, size)}
        alt="Receipt"
        width={size}
        height={size}
        className="object-cover"
        style={{ width: size, height: size }}
      />
    </a>
  );
}
