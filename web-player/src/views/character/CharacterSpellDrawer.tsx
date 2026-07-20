import { C } from "@/lib/theme";
import type { FetchedSpellDetail } from "@/views/character/CharacterSpellShared";
import { DMG_COLORS, DMG_EMOJI, getScaledSpellDamage } from "@/views/character/CharacterSpellShared";

export function SpellDrawer({
  spell,
  sourceLabel,
  onClose,
  charLevel,
  maxSlotLevel,
  spellMod,
}: {
  spell: FetchedSpellDetail;
  sourceLabel?: string | null;
  onClose: () => void;
  charLevel?: number;
  maxSlotLevel?: number;
  spellMod?: number;
}) {
  const ordinals = ["Cantrip", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
  const textArr = Array.isArray(spell.text) ? spell.text : [String(spell.text ?? "")];
  const isConc = Boolean(spell.concentration);
  const isRitual = Boolean(spell.ritual);
  const levelLabel = spell.level === 0 ? "Cantrip" : `${ordinals[spell.level ?? 0] ?? `Level ${spell.level}`} spell`;
  const scaledDamage = getScaledSpellDamage(spell, charLevel ?? 1, maxSlotLevel ?? Math.max(1, spell.level ?? 1), spellMod);
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
              <span style={{ fontSize: "var(--fs-subtitle)" }}>{scaledDamage.types.map((type) => DMG_EMOJI[type] ?? "*").join(" ")}</span>
              <span style={{ fontSize: "var(--fs-small)", color: dmgColor, fontWeight: 700, textTransform: "capitalize" }}>{scaledDamage.types.join(" / ")}</span>
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
