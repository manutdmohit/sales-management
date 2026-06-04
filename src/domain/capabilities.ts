import type { BusinessType } from "./business-types";

export const FEATURES = [
  "pos",
  "inventory",
  "products",
  "purchases",
  "receivables",
  "manufacturing",
  "services",
  "appointments",
  "clients",
  "reports",
] as const;

export type Feature = (typeof FEATURES)[number];

const BASE: Feature[] = [
  "pos",
  "inventory",
  "products",
  "purchases",
  "receivables",
  // Every business has customers and sales, so the customer database
  // (contact details + purchase history) is available to all types.
  "clients",
  "reports",
];

export const CAPABILITIES: Record<BusinessType, Feature[]> = {
  // Vedic: makes goods from raw materials, then sells finished products
  MANUFACTURER: [...BASE, "manufacturing"],
  // Magic Touch: sells products (creams) AND offers services with appointments
  SERVICE_RETAIL: [...BASE, "services", "appointments"],
  GENERAL: [...BASE],
};

export function getCapabilities(type: BusinessType | string): Feature[] {
  return CAPABILITIES[type as BusinessType] ?? BASE;
}

export function hasFeature(
  type: BusinessType | string | undefined,
  feature: Feature
): boolean {
  if (!type) return BASE.includes(feature);
  return getCapabilities(type).includes(feature);
}
