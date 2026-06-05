import Image from "next/image";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

type BusinessLogoProps = {
  logoUrl?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  unoptimized?: boolean;
};

const sizeClasses = {
  sm: "size-8 rounded-lg",
  md: "size-9 rounded-xl",
  lg: "size-12 rounded-xl",
};

const iconSizes = {
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export function BusinessLogo({
  logoUrl,
  name,
  size = "md",
  className,
  unoptimized = false,
}: BusinessLogoProps) {
  const box = sizeClasses[size];

  if (logoUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-white shadow-sm ring-1 ring-border/60",
          box,
          className
        )}
      >
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          fill
          className="object-contain p-0.5"
          sizes={size === "lg" ? "48px" : size === "md" ? "36px" : "32px"}
          unoptimized={unoptimized}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "brand-gradient flex shrink-0 items-center justify-center text-white shadow-sm shadow-primary/40",
        box,
        className
      )}
    >
      <Layers className={iconSizes[size]} />
    </div>
  );
}
