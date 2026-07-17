import { C } from "@/lib/theme";
import { ChoiceBtn } from "./LevelUpParts";
import type { LevelUpFeatDetail } from "./LevelUpParts";
import type { ParsedFeatChoiceLike as LevelUpFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";
import { formatFeatPrerequisite } from "@/views/character/CharacterSheetUtils";
import { getFeatChoiceOptions } from "@/views/character-creator/utils/CharacterCreatorUtils";

export function FeatSelectionSection(props: {
  accentColor: string;
  featSearch: string;
  onFeatSearchChange: (value: string) => void;
  chosenFeatId: string;
  filteredFeatSummaries: Array<{ id: string; name: string }>;
  onChooseFeat: (featId: string) => void;
  chosenFeatDetail: LevelUpFeatDetail | null;
  featPrereqsMet: boolean;
  featRepeatableValid: boolean;
  featChoiceEntries: LevelUpFeatChoice[];
  featChoiceOptionsByKey: Record<string, string[]>;
  chosenFeatOptions: Record<string, string[]>;
  nextLevel: number;
  onToggleFeatOption: (choiceKey: string, option: string, count: number) => void;
}) {
  const {
    accentColor, featSearch, onFeatSearchChange, chosenFeatId, filteredFeatSummaries, onChooseFeat,
    chosenFeatDetail, featPrereqsMet, featRepeatableValid, featChoiceEntries, featChoiceOptionsByKey, chosenFeatOptions, nextLevel, onToggleFeatOption,
  } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="search"
          value={featSearch}
          onChange={(e) => onFeatSearchChange(e.target.value)}
          placeholder="Search feats..."
          style={{
            flex: "1 1 220px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            color: C.text,
            fontSize: "var(--fs-medium)",
            outline: "none",
          }}
        />
        <div style={{ fontSize: "var(--fs-small)", color: chosenFeatId ? accentColor : C.muted }}>
          {chosenFeatId ? "1 / 1 selected" : "Pick 1 feat"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, maxHeight: 260, overflowY: "auto", paddingRight: 4 }}>
        {filteredFeatSummaries.map((feat) => {
          const active = chosenFeatId === feat.id;
          const allowed = !active ? true : featPrereqsMet;
          return (
            <button
              key={feat.id}
              type="button"
              onClick={() => onChooseFeat(feat.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: "pointer",
                border: `2px solid ${active ? accentColor : "rgba(255,255,255,0.1)"}`,
                background: active ? `${accentColor}18` : "rgba(255,255,255,0.03)",
                color: active ? "#fff" : C.text,
                textAlign: "left",
                fontSize: "var(--fs-subtitle)",
                fontWeight: active ? 800 : 600,
                opacity: allowed ? 1 : 0.65,
              }}
            >
              {feat.name}
            </button>
          );
        })}
      </div>

      {chosenFeatDetail && (
        <div style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}>
          <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: "#fff", marginBottom: 8 }}>{chosenFeatDetail.name}</div>
          {formatFeatPrerequisite(chosenFeatDetail.parsed.prerequisite) && (
            <div style={{ fontSize: "var(--fs-small)", color: featPrereqsMet ? C.colorGold : C.colorPinkRed, marginBottom: 8, fontWeight: 700 }}>
              Prerequisite: {formatFeatPrerequisite(chosenFeatDetail.parsed.prerequisite)}
            </div>
          )}
          {!featPrereqsMet && (
            <div style={{ fontSize: "var(--fs-small)", color: C.colorPinkRed, marginBottom: 8, fontWeight: 800 }}>
              Prerequisite not met. This feat can't be chosen right now.
            </div>
          )}
          {featPrereqsMet && !featRepeatableValid && (
            <div style={{ fontSize: "var(--fs-small)", color: C.colorPinkRed, marginBottom: 8, fontWeight: 800 }}>
              This feat has already been taken and isn't repeatable.
            </div>
          )}
          {chosenFeatDetail.text && (
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {String(chosenFeatDetail.text ?? "").replace(/Source:.*$/ms, "").trim()}
            </div>
          )}
        </div>
      )}

      {chosenFeatDetail && featChoiceEntries.some((choice) => choice.type !== "spell" && choice.type !== "spell_list") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {featChoiceEntries
            .filter((choice) => choice.type !== "spell" && choice.type !== "spell_list")
            .map((choice) => {
            const choiceKey = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
            const selected = chosenFeatOptions[choiceKey] ?? [];
            const options = featChoiceOptionsByKey[choiceKey] ?? getFeatChoiceOptions(choice);
            return (
              <div key={choiceKey}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>
                    {choice.type === "ability_score"
                      ? "Ability Score Choice"
                      : choice.type === "spell_list"
                        ? "Spell List Choice"
                        : choice.type === "spell"
                          ? "Spell Choice"
                          : chosenFeatDetail.name}
                  </div>
                  <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? accentColor : C.muted }}>
                    {selected.length} / {choice.count}
                  </div>
                </div>
                {choice.type === "spell" && options.length === 0 && (
                  <div style={{ marginBottom: 8, fontSize: "var(--fs-small)", color: C.muted }}>
                    {(choice.dependsOnChoiceId ?? choice.linkedTo) ? "Choose the spell list first." : "No eligible spell options found."}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {options.map((option) => {
                    const isSelected = selected.includes(option);
                    const blocked = !featPrereqsMet || !featRepeatableValid || (!isSelected && selected.length >= choice.count);
                    return (
                      <ChoiceBtn
                        key={option}
                        active={isSelected}
                        onClick={() => {
                          if (blocked) return;
                          onToggleFeatOption(choiceKey, option, choice.count);
                        }}
                        accent={accentColor}
                      >
                        {option}
                      </ChoiceBtn>
                    );
                  })}
                </div>
                {(choice.note || choice.dependencyKind === "replacement") && (
                  <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>
                    {choice.note}
                    {choice.dependencyKind === "replacement" && !choice.note ? "Shown only if the granted spell is already known." : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
