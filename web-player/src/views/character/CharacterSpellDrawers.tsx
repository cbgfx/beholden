import React from "react";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import type { FetchedSpellDetail } from "@/views/character/CharacterSpellShared";
import { DMG_COLORS, DMG_EMOJI, getScaledSpellDamage } from "@/views/character/CharacterSpellShared";

interface AddSpellDrawerEntry {
  key: string;
  rawName: string;
  searchName: string;
  removable?: boolean;
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {flexiblePreparedLimit && flexiblePreparedLimit > 0 && (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.5 }}>
              Prepared spell list: {Math.min(flexiblePreparedCount ?? 0, flexiblePreparedLimit)} / {flexiblePreparedLimit}
            </div>
          )}
          {entries.some((entry) => entry.removable) && onRemoveSpell && (
            <div>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Current Spells
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {entries.filter((entry) => entry.removable).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => void onRemoveSpell(entry.rawName)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "5px 10px", borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                      color: C.text, cursor: "pointer",
                      fontSize: "var(--fs-small)", fontWeight: 700,
                    }}
                  >
                    <span>{entry.searchName}</span>
                    <span style={{ color: C.muted, fontWeight: 900 }}>x</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <input
              autoFocus
              type="search"
              value={spellSearch}
              onChange={(e) => onSpellSearchChange(e.target.value)}
              placeholder="Search spells..."
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.05)",
                color: C.text, fontSize: "var(--fs-medium)", outline: "none",
              }}
            />
          </div>

          {spellSearch.trim().length < 2 ? (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>Type at least 2 characters to search.</div>
          ) : spellSearchLoading ? (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>Searching...</div>
          ) : spellSearchResults.length === 0 ? (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>No matching spells found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {spellSearchResults.map((spell) => {
                const spellKey = spell.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                const alreadyKnown = knownSpellKeys.has(spellKey);
                const alreadyGranted = grantedSpellKeys.has(spellKey);
                const disabled = alreadyKnown || alreadyGranted;
                const preview = (Array.isArray(spell.text) ? spell.text.join(" ") : String(spell.text ?? "")).replace(/\s+/g, " ").trim();
                return (
                  <div key={spell.id} style={{
                    padding: "10px 12px", borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.025)",
                    display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "start",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{spell.name}</div>
                      <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>
                        {spell.level === 0 ? "Cantrip" : `Level ${spell.level ?? "-"}`}{spell.school ? ` · ${spell.school}` : ""}
                      </div>
                      {preview && (
                        <div style={{ marginTop: 5, fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1.45 }}>
                          {preview.slice(0, 160)}{preview.length > 160 ? "..." : ""}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => { if (!disabled) void onAddSpell?.({ name: spell.name, id: spell.id, level: spell.level }); }}
                      style={{
                        padding: "7px 10px", borderRadius: 8,
                        border: `1px solid ${disabled ? "rgba(255,255,255,0.10)" : `${accentColor}55`}`,
                        background: disabled ? "rgba(255,255,255,0.04)" : `${accentColor}18`,
                        color: disabled ? C.muted : accentColor,
                        cursor: disabled ? "default" : "pointer",
                        fontSize: "var(--fs-small)", fontWeight: 800, whiteSpace: "nowrap",
                      }}
                    >
                      {alreadyKnown ? "Added" : alreadyGranted ? "Granted" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </RightDrawer>
  );
}

export function SpellDrawer({
  spell,
  accentColor,
  onClose,
  charLevel,
  maxSlotLevel,
}: {
  spell: FetchedSpellDetail;
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
                {levelLabel}{spell.school ? ` · ${spell.school}` : ""}
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
              <span style={{ fontSize: "var(--fs-subtitle)" }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
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
        </div>
      </div>
    </>
  );
}
