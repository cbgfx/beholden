import type { CSSProperties } from "react";
import { withAlpha } from "@/lib/theme";

export const CURRENCY_CODES = ["PP", "GP", "SP", "CP"] as const;
export type CurrencyCode = typeof CURRENCY_CODES[number];

const CURRENCY_COLORS: Record<CurrencyCode, string> = {
  PP: "#b9d7ea",
  GP: "#f6c453",
  SP: "#cbd5e1",
  CP: "#d98b5f",
};

export function currencyPillStyle(code: CurrencyCode): CSSProperties {
  const color = CURRENCY_COLORS[code];
  return {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 10px",
    borderRadius: 999,
    border: `1px solid ${withAlpha(color, 0.42)}`,
    background: withAlpha(color, 0.12),
    color,
    fontSize: "var(--fs-small)",
    cursor: "pointer",
  };
}

export function currencyColor(code: CurrencyCode): string {
  return CURRENCY_COLORS[code];
}
