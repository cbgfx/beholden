import React from "react";
import { C } from "@/lib/theme";
import { ABILITY_KEYS, ABILITY_LABELS } from "@/views/character-creator/constants/CharacterCreatorConstants";
import { abilityMod } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { resolvedScores } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { detailBoxStyle } from "@/views/character-creator/shared/CharacterCreatorStyles";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { ClassDetail, BgDetail, RaceDetail } from "@/views/character-creator/utils/CharacterCreatorTypes";

interface CharacterCreatorSideSummaryProps {
  form: FormState;
  classDetail: ClassDetail | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  featAbilityBonuses: Record<string, number>;
}

export function CharacterCreatorSideSummary({
  form,
  classDetail,
  raceDetail,
  bgDetail,
  featAbilityBonuses,
}: CharacterCreatorSideSummaryProps) {
  const scores = resolvedScores(form, featAbilityBonuses);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {(classDetail || raceDetail || bgDetail) && (
        <div style={detailBoxStyle}>
          <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.accentHl, marginBottom: 10 }}>Character Summary</div>
          {classDetail && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Class </span>
              <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{classDetail.name}</span>
              {classDetail.hd && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>d{classDetail.hd}</span>}
            </div>
          )}
          {raceDetail && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Species </span>
              <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{raceDetail.name}</span>
              {raceDetail.speed && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>{raceDetail.speed} ft</span>}
            </div>
          )}
          {bgDetail && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Background </span>
              <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{bgDetail.name}</span>
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
      )}
    </div>
  );
}
