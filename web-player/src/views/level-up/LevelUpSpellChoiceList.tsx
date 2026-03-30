import React from "react";
import { C } from "@/lib/theme";
import { extractPrerequisite, stripPrerequisiteLine } from "@/views/character/CharacterSheetUtils";
import type { LevelUpSpellSummary } from "./LevelUpParts";

export function LevelUpSpellChoiceList({
  title,
  caption,
  spells,
  chosen,
  max,
  onToggle,
  isAllowed,
}: {
  title: string;
  caption: string;
  spells: LevelUpSpellSummary[];
  chosen: string[];
  max: number;
  onToggle: (id: string) => void;
  isAllowed?: (spell: LevelUpSpellSummary) => boolean;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const visibleSpells = React.useMemo(
    () => spells,
    [spells],
  );
  const activeSpell =
    visibleSpells.find((spell) => spell.id === activeId)
    ?? visibleSpells[0]
    ?? null;

  React.useEffect(() => {
    if (!activeSpell) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (activeId == null || !visibleSpells.some((spell) => spell.id === activeId)) {
      setActiveId(activeSpell.id);
    }
  }, [activeId, activeSpell, visibleSpells]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
          {chosen.length} / {max} · {caption}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {visibleSpells.map((spell) => {
          const active = chosen.includes(spell.id);
          const focused = activeSpell?.id === spell.id;
          const allowed = isAllowed ? isAllowed(spell) : true;
          const blocked = (!active && chosen.length >= max) || !allowed;
          const prerequisite = extractPrerequisite(spell.text);
          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => {
                setActiveId(spell.id);
                if (!blocked) onToggle(spell.id);
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: blocked ? "not-allowed" : "pointer",
                border: `2px solid ${active || focused ? C.accentHl : "rgba(255,255,255,0.1)"}`,
                background: active ? "rgba(56,182,255,0.14)" : focused ? "rgba(56,182,255,0.08)" : "rgba(255,255,255,0.03)",
                color: blocked ? C.muted : C.text,
                textAlign: "left",
                opacity: blocked ? 0.6 : 1,
                minHeight: 72,
              }}
            >
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{spell.name}</div>
              {spell.level != null && spell.level > 0 && (
                <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>
                  Level {spell.level}
                </div>
              )}
              {prerequisite && (
                <div style={{ marginTop: 6, fontSize: "var(--fs-tiny)", lineHeight: 1.35 }}>
                  <span style={{ color: allowed ? C.colorGold : C.colorPinkRed, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Prerequisite
                  </span>
                  <span style={{ color: allowed ? "rgba(251,191,36,0.92)" : "#fca5a5" }}> {prerequisite}</span>
                </div>
              )}
              {!allowed && prerequisite && (
                <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: C.colorPinkRed, fontWeight: 700 }}>
                  Prerequisite not met
                </div>
              )}
            </button>
          );
        })}
      </div>
      {activeSpell && (
        <div
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.accentHl }}>
            {activeSpell.name}
            {activeSpell.level != null && activeSpell.level > 0 ? (
              <span style={{ color: "rgba(160,180,220,0.65)", marginLeft: 6, fontSize: "var(--fs-small)" }}>
                Level {activeSpell.level}
              </span>
            ) : null}
          </div>
          {extractPrerequisite(activeSpell.text) && (
            <div style={{ marginTop: 8, fontSize: "var(--fs-small)", lineHeight: 1.45 }}>
              <span style={{ color: C.colorGold, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Prerequisite
              </span>
              <span style={{ color: "rgba(251,191,36,0.92)" }}> {extractPrerequisite(activeSpell.text)}</span>
            </div>
          )}
          {stripPrerequisiteLine(activeSpell.text).replace(/Source:.*$/ms, "").trim() && (
            <div
              style={{
                marginTop: 8,
                fontSize: "var(--fs-small)",
                lineHeight: 1.55,
                color: "rgba(191,227,255,0.82)",
                whiteSpace: "pre-wrap",
              }}
            >
              {stripPrerequisiteLine(activeSpell.text).replace(/Source:.*$/ms, "").trim()}
            </div>
          )}
        </div>
      )}
      {visibleSpells.length === 0 && (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>No eligible options found in compendium.</div>
      )}
    </div>
  );
}
