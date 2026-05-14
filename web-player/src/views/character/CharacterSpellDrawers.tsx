import React from "react";
import { EmptyState, ListShell, SubsectionLabel, Tag } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import type { FetchedSpellDetail } from "@/views/character/CharacterSpellShared";

export { SpellDrawer } from "./CharacterSpellDrawer";


interface AddSpellDrawerEntry {
  key: string;
  rawName: string;
  searchName: string;
  level?: number | null;
  removable?: boolean;
}

const LEVEL_GROUP_ORDER = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function formatSpellLevelLabel(level: number | null | undefined): string {
  if (level == null || level < 0) return "Unknown";
  if (level === 0) return "Cantrips";
  if (level === 1) return "1st Level";
  if (level === 2) return "2nd Level";
  if (level === 3) return "3rd Level";
  return `${level}th Level`;
}

export function AddSpellDrawer({
  accentColor,
  entries,
  knownSpellKeys,
  grantedSpellKeys,
  addSpellSourceLabel,
  flexiblePreparedLimit,
  flexiblePreparedCount,
  spellSearch,
  onSpellSearchChange,
  spellSearchLoading,
  spellSearchResults,
  onAddSpell,
  onRemoveSpell,
  onClose,
}: {
  accentColor: string;
  entries: AddSpellDrawerEntry[];
  knownSpellKeys: Set<string>;
  grantedSpellKeys: Set<string>;
  addSpellSourceLabel?: string;
  flexiblePreparedLimit?: number;
  flexiblePreparedCount?: number;
  spellSearch: string;
  onSpellSearchChange: (v: string) => void;
  spellSearchLoading: boolean;
  spellSearchResults: FetchedSpellDetail[];
  onAddSpell?: (spell: { name: string; id?: string; level?: number | null }) => Promise<void> | void;
  onRemoveSpell?: (name: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const query = spellSearch.trim();
  const removableEntries = React.useMemo(
    () =>
      entries
        .filter((entry) => entry.removable)
        .sort((a, b) => (a.level ?? 99) - (b.level ?? 99) || a.searchName.localeCompare(b.searchName)),
    [entries]
  );
  const groupedRemovableEntries = React.useMemo(() => {
    const grouped = new Map<number, AddSpellDrawerEntry[]>();
    for (const entry of removableEntries) {
      const level = typeof entry.level === "number" ? entry.level : -1;
      if (!grouped.has(level)) grouped.set(level, []);
      grouped.get(level)!.push(entry);
    }
    return LEVEL_GROUP_ORDER
      .filter((level) => grouped.has(level))
      .map((level) => ({
        level,
        spells: (grouped.get(level) ?? []).slice().sort((a, b) => a.searchName.localeCompare(b.searchName)),
      }));
  }, [removableEntries]);

  const groupedResults = React.useMemo(() => {
    const grouped = new Map<number, FetchedSpellDetail[]>();
    for (const spell of spellSearchResults) {
      const level = typeof spell.level === "number" ? spell.level : -1;
      if (!grouped.has(level)) grouped.set(level, []);
      grouped.get(level)!.push(spell);
    }
    return LEVEL_GROUP_ORDER
      .filter((level) => grouped.has(level))
      .map((level) => ({
        level,
        spells: (grouped.get(level) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [spellSearchResults]);

  return (
    <RightDrawer
      onClose={onClose}
      title={
        <>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: C.text }}>Add Spell</div>
          {addSpellSourceLabel && (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 3 }}>as {addSpellSourceLabel}</div>
          )}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        {flexiblePreparedLimit && flexiblePreparedLimit > 0 && (
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.5 }}>
            Prepared spell list: {Math.min(flexiblePreparedCount ?? 0, flexiblePreparedLimit)} / {flexiblePreparedLimit}
          </div>
        )}

        {removableEntries.length > 0 && onRemoveSpell && (
          <div>
            <SubsectionLabel>Current Spells</SubsectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {groupedRemovableEntries.map(({ level, spells }) => (
                <div key={`current:${level}`}>
                  <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {formatSpellLevelLabel(level)}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {spells.map((entry) => (
                      <div key={entry.key} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <Tag label={entry.searchName} color={C.text} />
                        <button
                          type="button"
                          onClick={() => void onRemoveSpell(entry.rawName)}
                          title={`Remove ${entry.searchName}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            color: C.muted,
                            cursor: "pointer",
                            fontSize: "var(--fs-small)",
                            fontWeight: 900,
                          }}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          <SubsectionLabel>Find Spells</SubsectionLabel>
          <input
            autoFocus
            type="search"
            value={spellSearch}
            onChange={(e) => onSpellSearchChange(e.target.value)}
            placeholder="Search spells..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)",
              color: C.text,
              fontSize: "var(--fs-medium)",
              outline: "none",
            }}
          />
        </div>

        <ListShell
          style={{
            borderColor: "rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.02)",
            maxHeight: "min(72vh, 820px)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 10 }}>
            {query.length < 2 ? (
              <EmptyState textColor={C.muted}>Type at least 2 characters to search.</EmptyState>
            ) : spellSearchLoading ? (
              <EmptyState textColor={C.muted}>Searching...</EmptyState>
            ) : spellSearchResults.length === 0 ? (
              <EmptyState textColor={C.muted}>No matching spells found.</EmptyState>
            ) : (
              groupedResults.map(({ level, spells }) => (
                <div key={level}>
                  <SubsectionLabel>{formatSpellLevelLabel(level)}</SubsectionLabel>
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {spells.map((spell) => {
                      const spellKey = spell.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                      const alreadyKnown = knownSpellKeys.has(spellKey);
                      const alreadyGranted = grantedSpellKeys.has(spellKey);
                      const disabled = alreadyKnown || alreadyGranted;
                      const preview = (Array.isArray(spell.text) ? spell.text.join(" ") : String(spell.text ?? ""))
                        .replace(/\s+/g, " ")
                        .trim();

                      return (
                        <button
                          key={spell.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            if (!disabled) void onAddSpell?.({ name: spell.name, id: spell.id, level: spell.level });
                          }}
                          style={{
                            padding: "9px 10px",
                            borderRadius: 10,
                            border: `1px solid ${disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.10)"}`,
                            background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.025)",
                            color: disabled ? C.muted : C.text,
                            cursor: disabled ? "default" : "pointer",
                            textAlign: "left",
                            display: "grid",
                            gridTemplateColumns: "1fr auto",
                            gap: 10,
                            alignItems: "start",
                            opacity: disabled ? 0.72 : 1,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: disabled ? C.muted : C.text }}>
                              {spell.name}
                            </div>
                            <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>
                              {spell.level === 0 ? "Cantrip" : `Level ${spell.level ?? "-"}`}
                              {spell.school ? ` - ${spell.school}` : ""}
                            </div>
                            {preview && (
                              <div style={{ marginTop: 5, fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1.4 }}>
                                {preview.slice(0, 120)}{preview.length > 120 ? "..." : ""}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {alreadyKnown ? <Tag label="Added" color={C.muted} /> : null}
                            {alreadyGranted ? <Tag label="Granted" color={accentColor} /> : null}
                            {!disabled ? (
                              <div
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: 8,
                                  border: `1px solid ${accentColor}55`,
                                  background: `${accentColor}18`,
                                  color: accentColor,
                                  fontSize: "var(--fs-small)",
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Add
                              </div>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </ListShell>
      </div>
    </RightDrawer>
  );
}

