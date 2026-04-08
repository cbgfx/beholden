import React from "react";
import { EmptyState, ListShell, SubsectionLabel, Tag } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import type { FetchedSpellDetail } from "@/views/character/CharacterSpellShared";
import { DMG_COLORS, DMG_EMOJI, getScaledSpellDamage } from "@/views/character/CharacterSpellShared";

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

export function SpellDrawer({
  spell,
  sourceLabel,
  accentColor,
  onClose,
  charLevel,
  maxSlotLevel,
}: {
  spell: FetchedSpellDetail;
  sourceLabel?: string | null;
  accentColor: string;
  onClose: () => void;
  charLevel?: number;
  maxSlotLevel?: number;
}) {
  const ordinals = ["Cantrip", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
  const textArr = Array.isArray(spell.text) ? spell.text : [String(spell.text ?? "")];
  const isConc = Boolean(spell.concentration);
  const isRitual = Boolean(spell.ritual);
  const levelLabel = spell.level === 0 ? "Cantrip" : `${ordinals[spell.level ?? 0] ?? `Level ${spell.level}`} spell`;
  const scaledDamage = getScaledSpellDamage(spell, charLevel ?? 1, maxSlotLevel ?? Math.max(1, spell.level ?? 1));
  const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : undefined;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(420px, 92vw)",
        background: "#111827",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0,
          background: "#111827", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: "var(--fs-title)", fontWeight: 900, color: C.text, lineHeight: 1.2 }}>
                {spell.name}
              </h2>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted, fontStyle: "italic" }}>
                {levelLabel}{spell.school ? ` - ${spell.school}` : ""}
                {isRitual && <span style={{ marginLeft: 6, color: C.colorRitual, fontStyle: "normal", fontWeight: 700 }}>ritual</span>}
                {isConc && <span style={{ marginLeft: 6, color: C.colorRitual, fontStyle: "normal", fontWeight: 700 }}>concentration</span>}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, fontSize: "var(--fs-hero)", lineHeight: 1, padding: "2px 4px", flexShrink: 0,
            }}>x</button>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1, background: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          {[
            { label: "Casting Time", value: spell.time ?? "-" },
            { label: "Range", value: (spell.range ?? "-").replace(/ feet?/i, " ft.") },
            { label: "Duration", value: spell.duration ?? "-" },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: "10px 12px", background: "#111827", textAlign: "center" }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {spell.components && (
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>{spell.components}</span>
          )}
          {scaledDamage && (
            <div style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${dmgColor}55`, background: `${dmgColor}15`,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontWeight: 800, fontSize: "var(--fs-medium)", color: C.text }}>{scaledDamage.dice}</span>
              <span style={{ fontSize: "var(--fs-subtitle)" }}>{DMG_EMOJI[scaledDamage.type] ?? "*"}</span>
              <span style={{ fontSize: "var(--fs-small)", color: dmgColor, fontWeight: 700, textTransform: "capitalize" }}>{scaledDamage.type}</span>
            </div>
          )}
        </div>

        <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          {textArr.filter(Boolean).map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: "var(--fs-subtitle)", color: "rgba(200,210,230,0.85)", lineHeight: 1.65 }}>
              {para}
            </p>
          ))}
          {spell.classes && (
            <p style={{ margin: "8px 0 0", fontSize: "var(--fs-small)", color: C.muted, fontStyle: "italic" }}>
              Classes: {spell.classes}
            </p>
          )}
          {sourceLabel && (
            <p style={{ margin: "8px 0 0", fontSize: "var(--fs-small)", color: C.muted }}>
              Source: {sourceLabel}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
