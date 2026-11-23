import { ItemChoicePreview } from "@/views/character-progression/ItemChoicePreview";
import { useItemChoiceDetails } from "@/views/character-progression/useItemChoiceDetails";
import { useChoicePreview } from "@/views/character-progression/useChoicePreview";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { C, withAlpha } from "@/lib/theme";

export function LevelUpItemChoiceList({
  title,
  caption,
  items,
  chosen,
  disabledIds,
  max,
  onToggle,
}: {
  title: string;
  caption: string;
  items: Array<{ id: string; name: string; rarity?: string | null; type?: string | null; attunement?: boolean }>;
  chosen: string[];
  disabledIds?: string[];
  max: number;
  onToggle: (id: string) => void;
}) {
  const translateUi = useUiTranslation("playerUi");

  const disabledIdSet = React.useMemo(() => new Set(disabledIds ?? []), [disabledIds]);
  const availableItems = React.useMemo(
    () => items.filter((item) => !chosen.includes(item.id)),
    [chosen, items],
  );
  const { activeItem, setActiveId } = useChoicePreview(availableItems);
  const details = useItemChoiceDetails(availableItems);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
          {chosen.length} / {max} · {caption}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {availableItems.map((item) => {
          const focused = activeItem?.id === item.id;
          const takenElsewhere = disabledIdSet.has(item.id);
          const blocked = chosen.length >= max || takenElsewhere;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveId(item.id);
                if (!blocked) onToggle(item.id);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: blocked ? "not-allowed" : "pointer",
                border: `2px solid ${focused ? C.accentHl : withAlpha(C.panelBorder, 0.1)}`,
                background: focused ? withAlpha(C.accentHl, 0.08) : withAlpha(C.panelBorder, 0.03),
                color: blocked ? C.muted : C.text,
                textAlign: "left",
                opacity: blocked ? 0.6 : 1,
                minHeight: 72,
              }}
            >
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{item.name}</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 4 }}>
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
      {activeItem && details[activeItem.id] && (
        <ItemChoicePreview item={activeItem} detail={details[activeItem.id]} />
      )}
      {availableItems.length === 0 && (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>{translateUi("No eligible options found in compendium.")}</div>
      )}
    </div>
  );
}
