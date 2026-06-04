import { getUnitSymbol } from "@/domain/units";

const DEFAULT_DECIMALS = 2;

/** Round to avoid floating-point display artifacts (e.g. 108.67999999999999). */
export function roundQuantity(
  value: number,
  maxDecimals = DEFAULT_DECIMALS
): number {
  const factor = 10 ** maxDecimals;
  return Math.round(value * factor) / factor;
}

/** Format a stock/quantity for display — whole numbers without decimals, else up to 2 dp. */
export function formatQuantity(
  value: number,
  maxDecimals = DEFAULT_DECIMALS
): string {
  const rounded = roundQuantity(value, maxDecimals);
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

export function quantityUnitLabel(value: number, unitId?: string): string {
  const symbol = getUnitSymbol(unitId);
  if (symbol) return symbol;
  return roundQuantity(value) === 1 ? "unit" : "units";
}

/** e.g. "108.68 kg" or "60 pack" */
export function formatQuantityWithUnit(
  value: number,
  unitId?: string,
  maxDecimals = DEFAULT_DECIMALS
): string {
  const qty = formatQuantity(value, maxDecimals);
  const symbol = getUnitSymbol(unitId);
  return symbol ? `${qty} ${symbol}` : qty;
}

/** Fix float artifacts in persisted text (e.g. legacy notification messages). */
export function sanitizeDecimalInText(text: string): string {
  return text.replace(/(-?\d+\.\d{3,})/g, (match) => {
    const n = Number(match);
    return Number.isFinite(n) ? formatQuantity(n) : match;
  });
}
