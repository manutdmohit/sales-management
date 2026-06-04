import {
  defaultUnitForKind,
  STOCK_UNITS,
  type StockUnitId,
} from "@/domain/units";
import type { ProductKind } from "@/domain/types";
import { cn } from "@/lib/utils";

type UnitSelectProps = {
  id?: string;
  value: string;
  onChange: (unitId: StockUnitId) => void;
  productKind?: ProductKind;
  className?: string;
  required?: boolean;
};

export function UnitSelect({
  id,
  value,
  onChange,
  productKind,
  className,
  required,
}: UnitSelectProps) {
  const fallback = productKind ? defaultUnitForKind(productKind) : "piece";

  return (
    <select
      id={id}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
        className
      )}
      value={value || fallback}
      required={required}
      onChange={(e) => onChange(e.target.value as StockUnitId)}
    >
      {STOCK_UNITS.map((unit) => (
        <option key={unit.id} value={unit.id}>
          {unit.label} ({unit.symbol})
        </option>
      ))}
    </select>
  );
}
