import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { addBtnStyle } from "@/views/character/CharacterViewParts";
import { formatWeight } from "@/views/character/CharacterInventory";

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
  const [currencyPopupCode, setCurrencyPopupCode] = useState<"PP" | "GP" | "SP" | "CP" | null>(null);
  const [currencyInput, setCurrencyInput] = useState("");
  const currencyPopupRef = useRef<HTMLDivElement | null>(null);

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
        {(["PP", "GP", "SP", "CP"] as const).map((code) => (
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
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--fs-small)",
                color: C.text,
                padding: "2px 10px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                cursor: "pointer",
              }}
            >
              <span style={{ color: C.muted, fontWeight: 700 }}>{code}</span>
              <span style={{ fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currencyTotals[code].toLocaleString()}</span>
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
                    type="number"
                    min={0}
                    value={currencyInput}
                    onChange={(e) => setCurrencyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void onSaveCurrency(code, Number(currencyInput));
                        setCurrencyPopupCode(null);
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
                  <button
                    type="button"
                    onClick={() => {
                      void onSaveCurrency(code, Number(currencyInput));
                      setCurrencyPopupCode(null);
                    }}
                    style={addBtnStyle(accentColor)}
                  >
                    Save
                  </button>
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
