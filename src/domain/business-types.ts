export const BUSINESS_TYPES = [
  "PHARMACY",
  "SALON",
  "RETAIL",
  "GENERAL",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  PHARMACY: "Pharmacy",
  SALON: "Salon & beauty",
  RETAIL: "Retail",
  GENERAL: "General",
};
