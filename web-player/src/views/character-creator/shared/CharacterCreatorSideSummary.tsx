import { C } from "@/lib/theme";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { abilityMod } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { deriveRaceAbilityBonuses, resolvedScores } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { detailBoxStyle } from "@/views/character-creator/shared/CharacterCreatorStyles";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { ClassDetail, BgDetail, RaceDetail } from "@/views/character-creator/utils/CharacterCreatorTypes";

interface CharacterCreatorSideSummaryProps {
  form: FormState;
  classDetail: ClassDetail | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  featAbilityBonuses: Record<string, number>;
  fallbackClassName?: string;
  fallbackClassHd?: number | null;
  fallbackRaceName?: string;
  fallbackRaceSpeed?: number | null;
  fallbackBgName?: string;
}

export function CharacterCreatorSideSummary({
  form,
  classDetail,
  raceDetail,
  bgDetail,
  featAbilityBonuses,
  fallbackClassName,
  fallbackClassHd,
  fallbackRaceName,
  fallbackRaceSpeed,
  fallbackBgName,
}: CharacterCreatorSideSummaryProps) {
  const raceAbilityBonuses = deriveRaceAbilityBonuses(raceDetail, raceDetail?.parsedChoices?.abilityScoreChoice, form);
  const scores = resolvedScores(form, featAbilityBonuses, raceAbilityBonuses);
  const className = classDetail?.name ?? fallbackClassName;
  const classHd = classDetail?.hd ?? fallbackClassHd ?? null;
  const raceName = raceDetail?.name ?? fallbackRaceName;
  const raceSpeed = raceDetail?.speed ?? fallbackRaceSpeed ?? null;
  const bgName = bgDetail?.name ?? fallbackBgName;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={detailBoxStyle}>
        <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.accentHl, marginBottom: 10 }}>Character Summary</div>
        {className && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Class </span>
            <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{className}</span>
            {classHd && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>d{classHd}</span>}
          </div>
        )}
        {raceName && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Species </span>
            <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{raceName}</span>
            {raceSpeed && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>{raceSpeed} ft</span>}
          </div>
        )}
        {bgName && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Background </span>
            <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{bgName}</span>
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Level </span>
          <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{form.level}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
          {ABILITY_KEYS.map(k => {
            const score = scores[k] ?? 10;
            const mod = abilityMod(score);
            return (
              <div key={k} style={{ textAlign: "center", padding: "5px 4px", borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase" }}>{ABILITY_LABELS[k]}</div>
                <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)" }}>{score}</div>
                <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{mod >= 0 ? "+" : ""}{mod}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
