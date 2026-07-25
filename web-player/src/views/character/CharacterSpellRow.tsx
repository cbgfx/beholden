import { C } from "@/lib/theme";
import { DMG_EMOJI, abbrevTime, type FetchedSpellDetail } from "@/views/character/CharacterSpellShared";

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function spellUsesSave(d: FetchedSpellDetail | undefined): boolean {
  return Boolean(d?.check && d.check !== "attack");
}
function spellUsesAttack(d: FetchedSpellDetail | undefined): boolean {
  return d?.check === "attack";
}

export interface SpellRowEntry {
  key: string;
  searchName: string;
  source: string;
  forcedPrepared: boolean;
}

export function CharacterSpellRow({
  entry,
  detail,
  isCantrip,
  accentColor,
  spellRowGrid,
  usesFlexiblePreparedList,
  usesPreparedSpellSelection,
  isPrepared,
  preparedLocked,
  preparedLimit,
  entrySaveDc,
  entrySpellAtk,
  scaledDamageText,
  scaledDamageTypes,
  dmgColor,
  spellcastingBlocked,
  onTogglePrepared,
  onSelect,
}: {
  entry: SpellRowEntry;
  detail: FetchedSpellDetail | undefined;
  isCantrip: boolean;
  accentColor: string;
  spellRowGrid: string;
  usesFlexiblePreparedList: boolean;
  usesPreparedSpellSelection: boolean;
  isPrepared: boolean;
  preparedLocked: boolean;
  preparedLimit: number;
  entrySaveDc: number;
  entrySpellAtk: number;
  scaledDamageText: string | null;
  scaledDamageTypes: string[];
  dmgColor: string | null;
  spellcastingBlocked: boolean;
  onTogglePrepared: () => void;
  onSelect: () => void;
}) {
  const d = detail;
  const isAlwaysPrepared = entry.forcedPrepared;
  const conc = d ? Boolean(d.concentration) : false;
  const usesSave = spellUsesSave(d);
  const usesAtk = spellUsesAttack(d);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: spellRowGrid,
      alignItems: "center", gap: "0 8px",
      padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
      cursor: d ? "pointer" : "default",
    }}
      onClick={(ev) => {
        if ((ev.target as HTMLElement).closest("button")) return;
        if (d) onSelect();
      }}
    >
      {/* Prepared radio */}
      {usesFlexiblePreparedList && (
        <button
          onClick={() => {
            if (usesPreparedSpellSelection && !isCantrip && !isAlwaysPrepared && !preparedLocked) {
              onTogglePrepared();
            }
          }}
          title={
            !usesPreparedSpellSelection
              ? isCantrip
                ? "Known cantrip"
                : usesFlexiblePreparedList
                  ? "On your prepared spell list"
                  : "Known spell"
              : isCantrip
                ? "Cantrip (always prepared)"
                : isAlwaysPrepared
                  ? "Always prepared"
                : isPrepared
                  ? "Mark unprepared"
                  : preparedLocked
                    ? `Prepared limit reached (${preparedLimit})`
                    : "Mark prepared"
          }
          style={{
            width: 20, height: 20, borderRadius: "50%", padding: 0,
            cursor: !usesPreparedSpellSelection || isCantrip || isAlwaysPrepared || preparedLocked ? "default" : "pointer",
            border: `2px solid ${
              isAlwaysPrepared
                ? "rgba(196,181,253,0.95)"
                : isPrepared
                  ? accentColor
                  : "rgba(255,255,255,0.25)"
            }`,
            background: isAlwaysPrepared ? "rgba(196,181,253,0.28)" : isPrepared ? accentColor : preparedLocked ? "rgba(255,255,255,0.05)" : "transparent",
            opacity: preparedLocked ? 0.65 : 1,
            flexShrink: 0,
          }}
        />
      )}

      {/* Name + meta */}
      <div style={{ minWidth: 0 }} title={entry.source ? `Granted by: ${entry.source}` : undefined}>
        <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: isPrepared ? C.text : C.muted }}>
          {entry.searchName}
          {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: "var(--fs-tiny)", color: C.colorRitual }}>◆</span>}
        </div>
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
          {[d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0]} ${d.school ?? ""}`.trim() : null, d?.components].filter(Boolean).join("  (") + (d?.components ? ")" : "")}
        </div>
      </div>

      {/* Time */}
      <div style={{ minWidth: 0, fontSize: "var(--fs-small)", color: C.muted, textAlign: "center", lineHeight: 1.25 }}>
        {d ? abbrevTime(d.time ?? "—") : ""}
      </div>

      {/* HIT / SAVE */}
      {d && (usesSave || usesAtk) ? (
        <div style={{ minWidth: 0, textAlign: "center" }}>
          <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
            {usesSave ? (d.save ?? "SAVE") : "ATK"}
          </div>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: spellcastingBlocked ? C.colorPinkRed : accentColor, lineHeight: 1.2 }}>
            {usesSave ? `${entrySaveDc}${spellcastingBlocked ? " X" : ""}` : `+${entrySpellAtk}${spellcastingBlocked ? " X" : ""}`}
          </div>
        </div>
      ) : <div />}

      {/* Effect */}
      {scaledDamageText ? (
        <div style={{
          minWidth: 0,
          padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
          background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
        }}>
          <span style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.text }}>{scaledDamageText}</span>
          <span style={{ fontSize: "var(--fs-small)", marginLeft: 3 }}>{scaledDamageTypes.map((type) => DMG_EMOJI[type] ?? "◆").join(" ")}</span>
        </div>
      ) : <div />}
    </div>
  );
}
