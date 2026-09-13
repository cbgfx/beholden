import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "@/lib/theme";
import type { PartyCurrencyMap } from "@/services/inventoryApi";
import { formatWeight } from "@/views/character/inventory/CharacterInventory";
import { Button } from "@/ui/Button";
import { PartyStashItemRow, type PartyStashItem } from "@/views/character/inventory/CharacterInventoryPanelRows";
import { evaluateCurrencyInput } from "@/views/character/inventory/currencyMath";
import { CURRENCY_CODES, currencyColor, currencyPillStyle } from "@/views/character/inventory/currencyPillStyles";

const emptyContainerStyle = {
  padding: "8px 10px",
  border: "1px dashed rgba(255,255,255,0.08)",
  borderRadius: 10,
  color: C.muted,
  fontSize: "var(--fs-small)",
  background: "rgba(255,255,255,0.02)",
};

export interface InventoryPartyStashSectionProps {
  stashItems: PartyStashItem[];
  stashWeight: number;
  partyCapacityLbs: number | null;
  currency: PartyCurrencyMap;
  campaignId: string;
  onOpen: (item: PartyStashItem) => void;
  onTake: (item: PartyStashItem) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  onQuantity: (id: string, quantity: number) => Promise<unknown>;
  onCurrencyChange: (patch: Partial<PartyCurrencyMap>) => Promise<boolean>;
}

function PartyCurrencyBar({ currency, onCurrencyChange, stashWeight, partyCapacityLbs }: {
  currency: PartyCurrencyMap;
  onCurrencyChange: (patch: Partial<PartyCurrencyMap>) => Promise<boolean>;
  stashWeight: number;
  partyCapacityLbs: number | null;
}) {
  const { t } = useTranslation();
  const [popupCode, setPopupCode] = useState<typeof CURRENCY_CODES[number] | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popupCode) return;
    function handlePointerDown(e: MouseEvent) {
      if (popupRef.current && e.target instanceof Node && !popupRef.current.contains(e.target)) {
        if (!pending.current) setPopupCode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [popupCode]);

  const save = async (code: typeof CURRENCY_CODES[number]) => {
    if (pending.current) return;
    const value = evaluateCurrencyInput(input);
    if (value === null) return;
    const patch = { [code]: value } as Partial<PartyCurrencyMap>;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      if (await onCurrencyChange(patch)) setPopupCode(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("characterInventoryCurrencyBar.unableToSaveCurrency"));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const overCapacity = partyCapacityLbs !== null && stashWeight > partyCapacityLbs;
  const weightUnit = t("units.lb", { ns: "shared" });
  const weightLabel = partyCapacityLbs !== null
    ? t("characterInventoryPanel.stashWeightWithCapacity", { weight: formatWeight(stashWeight), capacity: formatWeight(partyCapacityLbs), unit: weightUnit })
    : t("characterInventoryPanel.stashWeightOnly", { weight: formatWeight(stashWeight), unit: weightUnit });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 2px 10px", marginBottom: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {t("characterInventoryCurrencyBar.currencyLabel")}
        </div>
      {CURRENCY_CODES.map((code) => (
        <div key={code} ref={popupCode === code ? popupRef : undefined} style={{ position: "relative" }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => { setError(null); setInput(String(currency[code])); setPopupCode((c) => c === code ? null : code); }}
            style={currencyPillStyle(code)}
          >
            <span style={{ color: currencyColor(code), fontWeight: 800 }}>{code}</span>
            <span style={{ color: C.text, fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currency[code].toLocaleString()}</span>
          </button>
          {popupCode === code && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
              background: "#1e2030", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "12px 14px", minWidth: 210,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, marginBottom: 2 }}>{t("characterInventoryCurrencyBar.editCurrencyTitle", { code })}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  autoFocus
                  disabled={saving}
                  type="text"
                  inputMode="numeric"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void save(code);
                    if (e.key === "Escape" && !pending.current) setPopupCode(null);
                  }}
                  style={{
                    flex: 1, padding: "6px 8px", borderRadius: 6,
                    fontSize: "var(--fs-subtitle)", fontWeight: 700,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.07)", color: C.text,
                    outline: "none", textAlign: "center",
                  }}
                />
                <Button type="button" variant="primary" disabled={saving} onClick={() => void save(code)} style={{ padding: "6px 14px", fontSize: "var(--fs-subtitle)", borderRadius: 7 }}>
                  {saving ? t("characterInventoryCurrencyBar.savingButtonLabel") : t("characterInventoryCurrencyBar.saveButtonLabel")}
                </Button>
              </div>
              {error ? <div role="alert" style={{ color: C.red }}>{error}</div> : null}
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
  onOpen,
  onTake,
  onDelete,
  onQuantity,
  onCurrencyChange,
}: InventoryPartyStashSectionProps) {
  const { t } = useTranslation();
  // Take/remove/quantity all hit the server. Surface a failure (a lost race, an
  // offline device) instead of letting the rejected promise vanish, and hold off
  // a second overlapping request while one is in flight.
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true;
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("characterInventoryCurrencyBar.stashUpdateError"));
    } finally {
      pending.current = false;
    }
  };

  return (
    <>
      <PartyCurrencyBar
        key={campaignId}
        currency={currency}
        onCurrencyChange={onCurrencyChange}
        stashWeight={stashWeight}
        partyCapacityLbs={partyCapacityLbs}
      />
      {error ? (
        <div role="alert" style={{ color: C.red, fontSize: "var(--fs-small)", padding: "0 2px 8px" }}>{error}</div>
      ) : null}
      {stashItems.length === 0 ? (
        <div style={emptyContainerStyle}>
          {t("characterInventoryCurrencyBar.emptyStash")}
        </div>
      ) : (
        stashItems.map((it) => (
          <PartyStashItemRow
            key={it.id}
            item={it}
            onOpen={() => onOpen(it)}
            onTake={() => void run(() => onTake(it))}
            onDelete={() => void run(() => onDelete(it.id))}
            onQuantity={(q) => void run(() => onQuantity(it.id, q))}
          />
        ))
      )}
    </>
  );
}
