import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { C } from "@/lib/theme";
import { CollapsiblePanel, ProfDot, Tooltip } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";
import { getModifierState, StateBadge } from "@/views/character/CharacterAbilitiesPanelHelpers";
import type { AbilKey, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { ABILITY_LABELS, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { getSkillBonus, getSkillProficiencyTier } from "@/views/character/CharacterSheetUtils";

export interface SkillsPanelProps {
  scores: Record<AbilKey, number | null>;
  pb: number;
  prof?: ProficiencyMap | null;
  skillBonuses?: Record<string, number>;
  skillAdvantages?: Record<string, boolean>;
  skillDisadvantages?: Record<string, boolean>;
  accentColor: string;
  stealthDisadvantage: boolean;
  nonProficientArmorPenalty: boolean;
  hasJackOfAllTrades?: boolean;
  d20TestPenalty?: number;
  fmtMod: (value: number) => string;
}

export function SkillsPanel({
  scores,
  pb,
  prof,
  skillBonuses,
  skillAdvantages,
  skillDisadvantages,
  accentColor,
  stealthDisadvantage,
  nonProficientArmorPenalty,
  hasJackOfAllTrades = false,
  d20TestPenalty = 0,
  fmtMod,
}: SkillsPanelProps) {
  const translateUi = useUiTranslation("playerUi");
  const skillColumns = 2;
  const skillsPerColumn = Math.ceil(ALL_SKILLS.length / skillColumns);
  const orderedSkillsForGrid = Array.from({ length: skillsPerColumn }).flatMap((_, rowIndex) => {
    const row: (typeof ALL_SKILLS)[number][] = [];
    for (let columnIndex = 0; columnIndex < skillColumns; columnIndex += 1) {
      const skill = ALL_SKILLS[columnIndex * skillsPerColumn + rowIndex];
      if (skill) row.push(skill);
    }
    return row;
  });

  return (
    <CollapsiblePanel
      title={translateUi("Skills")}
      color={accentColor}
      storageKey={PANEL_IDS.skills}
      summary={translateUi("{{count}} proficient", { count: new Set([...(prof?.skills ?? []), ...(prof?.expertise ?? [])].map((entry) => entry.name.toLowerCase())).size })}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
        {orderedSkillsForGrid.map(({ name, abil }) => {
          const tier = getSkillProficiencyTier(prof ?? undefined, name);
          const isProfSkill = tier >= 1;
          const isExpertise = tier >= 2;
          const extraSkillBonus = skillBonuses?.[name] ?? 0;
          const bonus = getSkillBonus(name, abil, scores, Math.max(1, (pb - 1) * 4), prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades }) + extraSkillBonus - d20TestPenalty;
          const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
          const expertiseSrc = prof?.expertise.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
          const armorPenalty = nonProficientArmorPenalty && (abil === "str" || abil === "dex");
          const stealthPenalty = name === "Stealth" && stealthDisadvantage;
          const skillState = getModifierState(Boolean(skillAdvantages?.[name]), Boolean(skillDisadvantages?.[name]) || armorPenalty || stealthPenalty);
          return (
            <div
              key={name}
              className="character-hover-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 4px",
                borderRadius: 4,
                minWidth: 0,
              }}
            >
              <ProfDot filled={isProfSkill} color={isExpertise ? accentColor : C.green} />
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
                {translateUi(ABILITY_LABELS[abil])}
              </span>
              <span
                style={{
                  fontSize: "var(--fs-small)",
                  color: isProfSkill ? C.text : C.muted,
                  flex: 1,
                  fontWeight: isProfSkill ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{translateUi(name)}</span>
                {isExpertise && (
                  <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: accentColor }}>{translateUi("EXP")}</span>
                )}
                <StateBadge
                  state={skillState}
                  accentColor={accentColor}
                  title={translateUi("{{value1}} on {{value2}} checks", { value1: translateUi(skillState === "advantage" ? "Advantage" : "Disadvantage"), value2: translateUi(name) })}
                />
              </span>
              <span
                style={{
                  fontSize: "var(--fs-subtitle)",
                  fontWeight: 700,
                  minWidth: 26,
                  textAlign: "right",
                  color: skillState === "disadvantage" ? C.colorPinkRed : skillState === "advantage" ? accentColor : isExpertise ? accentColor : isProfSkill ? C.green : C.text,
                }}
              >
                {(isProfSkill && (src || expertiseSrc)) || extraSkillBonus !== 0
                  ? <Tooltip text={[src, expertiseSrc, extraSkillBonus !== 0 ? translateUi("Feature bonus {{value1}}", { value1: fmtMod(extraSkillBonus) }) : null].filter(Boolean).join(" - ")}>{fmtMod(bonus)}</Tooltip>
                  : fmtMod(bonus)}
              </span>
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
}
