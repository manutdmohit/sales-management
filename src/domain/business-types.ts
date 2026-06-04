export const BUSINESS_TYPES = [
  "MANUFACTURER",
  "SERVICE_RETAIL",
  "GENERAL",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const DEFAULT_CURRENCY = "NPR";

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  MANUFACTURER: "Manufacturing",
  SERVICE_RETAIL: "Service & retail",
  GENERAL: "General",
};

/** Safe label lookup that tolerates legacy/unknown type values. */
export function businessTypeLabel(type: BusinessType | string): string {
  return BUSINESS_TYPE_LABELS[type as BusinessType] ?? "General";
}
