import { C } from "@/lib/theme";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { ABILITY_LABELS, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { abilityMod, formatModifier, hasNamedProficiency } from "@/views/character/CharacterSheetUtils";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";
import { MiniStat, Panel, SubsectionLabel } from "@beholden/shared/ui";
import type { Proficiencies } from "./PartyMemberView";
import { MINI_STAT_THEME } from "./PartyMemberTheme";

export function PartyMemberStatsColumn({
  scores,
  prof,
  color,
  pb,
  passivePerc,
  hitDie,
}: {
  scores: Record<AbilKey, number | null>;
  prof: Proficiencies | undefined;
  color: string;
  pb: number;
  passivePerc: number;
  hitDie: number | undefined;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <SubsectionLabel>Ability Scores</SubsectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {(Object.keys(ABILITY_LABELS) as AbilKey[]).map((ability) => {
            const score = scores[ability];
            const mod = abilityMod(score);
            const saveProf = hasNamedProficiency(prof?.saves ?? [], ABILITY_LABELS[ability]);
            return (
              <div
                key={ability}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 8,
                  padding: "8px 4px",
                  border: saveProf ? `1px solid ${color}33` : "1px solid transparent",
                }}
              >
                <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {ABILITY_LABELS[ability]}
                </span>
                <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: C.text, lineHeight: 1.1, margin: "2px 0" }}>
                  {score ?? "--"}
                </span>
                <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: saveProf ? color : C.muted }}>
                  {formatModifier(saveProf ? mod + pb : mod)}
                  {saveProf ? <span style={{ marginLeft: 2, fontSize: "var(--fs-tiny)" }}>*</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel>
        <SubsectionLabel>Stats</SubsectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          <MiniStat label="Prof" value={`+${pb}`} accent={color} theme={MINI_STAT_THEME} />
          <MiniStat label="Pass. Perc" value={String(passivePerc)} theme={MINI_STAT_THEME} />
          <MiniStat label="Hit Die" value={hitDie ? `d${hitDie}` : "--"} theme={MINI_STAT_THEME} />
        </div>
      </Panel>

      {prof?.skills && prof.skills.length > 0 ? (
        <CollapsiblePanel title="Skills" color={color} storageKey="party-member-skills" defaultOpen>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
            {ALL_SKILLS.map(({ name, abil }) => {
              const isProficient = hasNamedProficiency(prof.skills ?? [], name);
              const isExpertise = hasNamedProficiency(prof.expertise ?? [], name);
              const bonus = abilityMod(scores[abil]) + (isExpertise ? pb * 2 : isProficient ? pb : 0);
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 4px",
                    borderRadius: 4,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isProficient ? (isExpertise ? color : C.green) : "transparent",
                      border: `1.5px solid ${isProficient ? (isExpertise ? color : C.green) : "rgba(255,255,255,0.2)"}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 700,
                      color: "rgba(160,180,220,0.45)",
                      letterSpacing: "0.04em",
                      width: 24,
                      textAlign: "center",
                    }}
                  >
                    {ABILITY_LABELS[abil]}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-small)",
                      color: isProficient ? C.text : C.muted,
                      flex: 1,
                      fontWeight: isProficient ? 600 : 400,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-subtitle)",
                      fontWeight: 700,
                      minWidth: 26,
                      textAlign: "right",
                      color: isExpertise ? color : isProficient ? C.green : C.text,
                    }}
                  >
                    {formatModifier(bonus)}
                  </span>
                </div>
              );
            })}
          </div>
        </CollapsiblePanel>
      ) : null}
    </div>
  );
}
