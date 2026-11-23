import { ItemChoicePreview } from "@/views/character-progression/ItemChoicePreview";
import { useItemChoiceDetails } from "@/views/character-progression/useItemChoiceDetails";
import { useChoicePreview } from "@/views/character-progression/useChoicePreview";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { C, withAlpha } from "@/lib/theme";
import { inputStyle, labelStyle } from "./CharacterCreatorStyles";

export function ItemPicker<T extends { id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>({
  title,
  sourceLabel,
  items,
  chosen,
  disabledIds,
  max,
  emptyMsg,
  onToggle,
}: {
  title: string;
  sourceLabel?: string | null;
  items: T[];
  chosen: string[];
  disabledIds?: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
}) {
  const translateUi = useUiTranslation("playerUi");
  const [q, setQ] = React.useState("");

  const trimmedSourceLabel = String(sourceLabel ?? "").trim();
  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const filtered = q
    ? items.filter((item) => item.name.toLowerCase().includes(q.toLowerCase()))
    : items;
  const { activeItem, setActiveId } = useChoicePreview(items, filtered);
  const details = useItemChoiceDetails(filtered);

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {title}
          {trimmedSourceLabel ? <span style={{ marginLeft: 8, fontSize: "var(--fs-small)", color: C.accentHl }}>{trimmedSourceLabel}</span> : null}
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {items.length === 0 ? (
        <p style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{emptyMsg}</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={translateUi("Search…")} style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 240, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((item) => {
              const sel = chosen.includes(item.id);
              const takenElsewhere = !sel && disabledIdSet.has(item.id);
              const locked = (!sel && chosen.length >= max) || takenElsewhere;
              const active = activeItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setActiveId(item.id);
                    onToggle(item.id);
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: "var(--fs-small)",
                    cursor: locked ? "default" : "pointer",
                    border: `1px solid ${sel || active ? C.accentHl : C.panelBorder}`,
                    background: sel
                      ? withAlpha(C.accentHl, 0.18)
                      : active
                        ? withAlpha(C.accentHl, 0.10)
                        : C.panelBg,
                    color: sel ? C.accentHl : locked ? withAlpha(C.muted, 0.35) : C.text,
                    fontWeight: sel ? 700 : 400,
                    textAlign: "left",
                    minWidth: 180,
                    maxWidth: 280,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1.35 }}>
                    {[item.rarity, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
                  </div>
                  {takenElsewhere && (
                    <div style={{ marginTop: 3, fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                      {translateUi("Already selected elsewhere")}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {activeItem && (
            <ItemChoicePreview item={activeItem} detail={details[activeItem.id]} />
          )}
        </>
      )}
    </div>
  );
}
