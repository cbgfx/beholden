import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import type { GroupedSpell } from "./useMonsterSpells";

type MonsterSpells = {
  spellNames: string[];
  groupedSpells: GroupedSpell[];
  openSpell: (ref: { id?: string | null; name: string }) => Promise<void> | void;
  spellOpen: boolean;
  spellLoading: boolean;
  spellError: string | null;
  spellDetail: any | null;
};

type Props = {
  /**
   * The output of useMonsterSpells(monster).
   * Kept as a single prop to avoid prop drift during refactors.
   */
  spells: MonsterSpells;
};

export function MonsterSpellPanel({ spells }: Props) {
  const spellNames = spells.spellNames ?? [];
  const groupedSpells = spells.groupedSpells ?? [];
  const spellOpen = spells.spellOpen;
  const spellLoading = spells.spellLoading;
  const spellError = spells.spellError;
  const spellDetail = spells.spellDetail;
  const onOpenSpell = (ref: { id?: string | null; name: string }) => spells.openSpell(ref);

  if (!spellNames.length) return null;

  const fallback = Array.from(
    new Set(spellNames.map((s) => String(s ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ color: theme.colors.accentPrimary, fontWeight: 900 }}>Spells</div>

      {groupedSpells.length ? (
        <div style={{ display: "grid", gap: 5 }}>
          {groupedSpells.map((g) => (
            <div key={g.level} style={{ display: "grid", gap: 4 }}>
              <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-medium)" }}>
                {g.title}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {g.spells.map((s) => (
                  <button
                    key={`${g.level}_${s.key}`}
                    type="button"
                    onClick={() => onOpenSpell({ id: s.spellId, name: s.display })}
                    style={{
                      border: `1px solid ${theme.colors.panelBorder}`,
                      background: withAlpha(theme.colors.shadowColor, 0.14),
                      color: theme.colors.text,
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                    title="Open spell"
                  >
                    {s.display}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {fallback.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onOpenSpell({ name })}
              style={
                {
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: withAlpha(theme.colors.shadowColor, 0.14),
                  color: theme.colors.text,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontWeight: 800,
                  cursor: "pointer",
                } as const
              }
              title="Open spell"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {spellOpen ? (
        <div
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 14,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: withAlpha(theme.colors.shadowColor, 0.14),
          }}
        >
          {spellLoading ? (
            <div style={{ color: theme.colors.muted }}>Loading spell…</div>
          ) : spellError ? (
            <div style={{ color: theme.colors.red }}>{spellError}</div>
          ) : spellDetail ? (
            <div>
              <div style={{ fontWeight: 900, marginBottom: 4 }}>{spellDetail.name}</div>
              <div style={{ color: theme.colors.muted, fontSize: "var(--fs-subtitle)", whiteSpace: "pre-wrap" }}>
                {Array.isArray(spellDetail.text) ? spellDetail.text.join("\n") : spellDetail.text}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
