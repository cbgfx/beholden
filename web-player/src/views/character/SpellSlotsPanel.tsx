import React from "react";
import { C } from "@/lib/theme";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";

interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
}

export interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
  }>;
}

export function SpellSlotsPanel({ classDetail, level, usedSpellSlots, onSave, accentColor }: {
  classDetail: ClassRestDetail | null;
  level: number;
  usedSpellSlots: Record<string, number>;
  onSave: (next: Record<string, number>) => Promise<void>;
  accentColor: string;
}) {
  const slots = classDetail?.autolevels.find((al) => al.level === level)?.slots ?? null;
  if (!slots) return null;

  const spellLevels = slots
    .map((count, i) => ({ level: i, count }))
    .filter(({ level: l, count }) => l > 0 && count > 0);

  if (!spellLevels.length) return null;

  async function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    const max = slots[spellLevel] ?? 0;
    const next = slotIndex < used ? slotIndex : Math.min(max, slotIndex + 1);
    await onSave({ ...usedSpellSlots, [key]: next });
  }

  async function longRest() {
    await onSave({});
  }

  return (
    <CollapsiblePanel title="Spell Slots" color={C.colorMagic} storageKey="spell-slots" actions={
      <button onClick={longRest} style={{
        fontSize: "var(--fs-tiny)", fontWeight: 700, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
        background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: C.colorMagic,
      }}>Long Rest</button>
    }>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {spellLevels.map(({ level: sl, count }) => {
          const used = usedSpellSlots[String(sl)] ?? 0;
          const remaining = count - used;
          const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
          return (
            <div key={sl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, minWidth: 30 }}>{ordinals[sl]}</div>
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {Array.from({ length: count }).map((_, i) => {
                  const filled = i >= used;
                  return (
                    <button
                      key={i}
                      title={filled ? "Expend slot" : "Restore slot"}
                      onClick={() => toggleSlot(sl, i)}
                      style={{
                        width: 22, height: 22, borderRadius: 4, padding: 0, cursor: "pointer",
                        border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.15)"}`,
                        background: filled ? `${accentColor}33` : "transparent",
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, minWidth: 36, textAlign: "right" }}>
                {remaining}/{count}
              </div>
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
}
