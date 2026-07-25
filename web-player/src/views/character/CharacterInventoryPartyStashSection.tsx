import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { patchPartyCurrency, type PartyCurrencyMap } from "@/services/inventoryApi";
import { formatWeight } from "@/views/character/CharacterInventory";
import { addBtnStyle } from "@/views/character/CharacterViewParts";
import { PartyStashItemRow, type PartyStashItem } from "@/views/character/CharacterInventoryPanelRows";
import { evaluateCurrencyInput } from "@/views/character/currencyMath";

const emptyContainerStyle = {
  padding: "8px 10px",
  border: "1px dashed rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: C.muted,
  fontSize: "var(--fs-small)",
  background: "rgba(255,255,255,0.02)",
};

const CURRENCY_CODES = ["PP", "GP", "SP", "CP"] as const;

export interface InventoryPartyStashSectionProps {
  stashItems: PartyStashItem[];
  stashWeight: number;
  partyCapacityLbs: number | null;
  currency: PartyCurrencyMap;
  campaignId: string;
  onTake: (item: PartyStashItem) => void;
  onDelete: (id: string) => void;
  onQuantity: (id: string, quantity: number) => void;
  onCurrencyChange: (patch: Partial<PartyCurrencyMap>) => void;
}

function PartyCurrencyBar({ currency, campaignId, onCurrencyChange, stashWeight, partyCapacityLbs }: {
  currency: PartyCurrencyMap;
  campaignId: string;
  onCurrencyChange: (patch: Partial<PartyCurrencyMap>) => void;
  stashWeight: number;
  partyCapacityLbs: number | null;
}) {
  const [popupCode, setPopupCode] = useState<typeof CURRENCY_CODES[number] | null>(null);
  const [input, setInput] = useState("");
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popupCode) return;
    function handlePointerDown(e: MouseEvent) {
      if (popupRef.current && e.target instanceof Node && !popupRef.current.contains(e.target)) {
        setPopupCode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [popupCode]);

  const save = async (code: typeof CURRENCY_CODES[number]) => {
    const value = evaluateCurrencyInput(input);
    if (value === null) return;
    const patch = { [code]: value } as Partial<PartyCurrencyMap>;
    onCurrencyChange(patch);
    patchPartyCurrency(campaignId, patch).catch(() => {
      onCurrencyChange({ [code]: currency[code] });
    });
    setPopupCode(null);
  };

  const overCapacity = partyCapacityLbs !== null && stashWeight > partyCapacityLbs;
  const weightLabel = partyCapacityLbs !== null
    ? `${formatWeight(stashWeight)} / ${formatWeight(partyCapacityLbs)} lb`
    : `${formatWeight(stashWeight)} lb`;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 2px 10px", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Currency
        </div>
      {CURRENCY_CODES.map((code) => (
        <div key={code} ref={popupCode === code ? popupRef : undefined} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => { setInput(String(currency[code])); setPopupCode((c) => c === code ? null : code); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: "var(--fs-small)", color: C.text,
              padding: "2px 10px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)", cursor: "pointer",
            }}
          >
            <span style={{ color: C.muted, fontWeight: 700 }}>{code}</span>
            <span style={{ fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currency[code].toLocaleString()}</span>
          </button>
          {popupCode === code && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
              background: "#1e2030", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "12px 14px", minWidth: 210,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit {code}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save(code);
                    if (e.key === "Escape") setPopupCode(null);
                  }}
                  style={{
                    flex: 1, padding: "6px 8px", borderRadius: 6,
                    fontSize: "var(--fs-subtitle)", fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.07)", color: C.text,
                    outline: "none", textAlign: "center",
                  }}
                />
                <button type="button" onClick={() => void save(code)} style={addBtnStyle("#6366f1")}>
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      </div>
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: overCapacity ? C.red : C.muted, flexShrink: 0 }}>
        {weightLabel}
      </div>
    </div>
  );
}

export function InventoryPartyStashSection({
  stashItems,
  stashWeight,
  partyCapacityLbs,
  currency,
  campaignId,
  onTake,
  onDelete,
  onQuantity,
  onCurrencyChange,
}: InventoryPartyStashSectionProps) {
  return (
    <>
      <PartyCurrencyBar
        currency={currency}
        campaignId={campaignId}
        onCurrencyChange={onCurrencyChange}
        stashWeight={stashWeight}
        partyCapacityLbs={partyCapacityLbs}
      />
      {stashItems.length === 0 ? (
        <div style={emptyContainerStyle}>
          Empty. Move an item here to share it with the party.
        </div>
      ) : (
        stashItems.map((it) => (
          <PartyStashItemRow
            key={it.id}
            item={it}
            onTake={() => onTake(it)}
            onDelete={() => onDelete(it.id)}
            onQuantity={(q) => onQuantity(it.id, q)}
          />
        ))
      )}
    </>
  );
}
