import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { formatWeight } from "@/views/character/CharacterInventory";
import { evaluateCurrencyInput } from "@/views/character/currencyMath";
import { Button } from "@/ui/Button";
import { CURRENCY_CODES, currencyColor, currencyPillStyle, type CurrencyCode } from "@/views/character/currencyPillStyles";

interface InventoryCurrencyBarProps {
  currencyTotals: Record<"PP" | "GP" | "EP" | "SP" | "CP", number>;
  carriedWeight: number;
  carryCapacity: number;
  overCapacity: boolean;
  accentColor: string;
  onSaveCurrency: (code: "PP" | "GP" | "SP" | "CP", value: number) => Promise<void>;
}

export function InventoryCurrencyBar({
  currencyTotals,
  carriedWeight,
  carryCapacity,
  overCapacity,
  accentColor,
  onSaveCurrency,
}: InventoryCurrencyBarProps) {
  // Buttons now use the canonical shared Button component (fixed app accent), so the
  // per-character accentColor prop is no longer consumed here — kept in the props contract
  // since callers still pass it and other consumers of this pattern may want it later.
  void accentColor;
  const [currencyPopupCode, setCurrencyPopupCode] = useState<CurrencyCode | null>(null);
  const [currencyInput, setCurrencyInput] = useState("");
  const currencyPopupRef = useRef<HTMLDivElement | null>(null);

  const saveCurrency = (code: CurrencyCode) => {
    const value = evaluateCurrencyInput(currencyInput);
    if (value === null) return;
    void onSaveCurrency(code, value);
    setCurrencyPopupCode(null);
  };

  useEffect(() => {
    if (!currencyPopupCode) return;
    function handlePointerDown(event: MouseEvent) {
      if (!currencyPopupRef.current) return;
      const target = event.target;
      if (target instanceof Node && !currencyPopupRef.current.contains(target)) {
        setCurrencyPopupCode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [currencyPopupCode]);

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 10,
      padding: "0 2px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Currency
        </div>
        {CURRENCY_CODES.map((code) => (
          <div
            key={code}
            ref={currencyPopupCode === code ? currencyPopupRef : undefined}
            style={{ position: "relative" }}
          >
            <button
              type="button"
              onClick={() => {
                setCurrencyInput(String(currencyTotals[code]));
                setCurrencyPopupCode((current) => current === code ? null : code);
              }}
              style={currencyPillStyle(code)}
            >
              <span style={{ color: currencyColor(code), fontWeight: 800 }}>{code}</span>
              <span style={{ color: C.text, fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currencyTotals[code].toLocaleString()}</span>
            </button>
            {currencyPopupCode === code && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  zIndex: 20,
                  background: "#1e2030",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  minWidth: 210,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit {code}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveCurrency(code);
                      }
                      if (e.key === "Escape") setCurrencyPopupCode(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      fontSize: "var(--fs-subtitle)",
                      fontWeight: 700,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(255,255,255,0.07)",
                      color: C.text,
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      saveCurrency(code);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: overCapacity ? C.red : C.muted }}>
        {formatWeight(carriedWeight)} / {formatWeight(carryCapacity)} lb
      </div>
    </div>
  );
}
