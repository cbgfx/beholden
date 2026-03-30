import React from "react";
import { C } from "@/lib/theme";
import { extractPrerequisite, stripPrerequisiteLine } from "@/views/character/CharacterSheetUtils";
import { getFeatChoiceOptions, normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import type { ParsedFeatChoiceLike as LevelUpFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";

export interface LevelUpSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface LevelUpFeatDetail {
  id: string;
  name: string;
  text?: string | null;
}

export interface LevelUpExpertiseChoice {
  key: string;
  source: string;
  count: number;
  options: string[] | null;
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{
        width: "min(75vw, 1100px)", maxWidth: "1100px", margin: "0 auto", padding: "24px 16px 140px",
        fontFamily: "system-ui, Segoe UI, Arial", color: C.text,
      }}>
        {children}
      </div>
    </div>
  );
}

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", color: C.muted,
      fontSize: "var(--fs-subtitle)", padding: "6px 0",
    }}>← Back</button>
  );
}

export function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 20, padding: "16px", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ChoiceBtn({ active, onClick, accent, children }: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  const color = accent ?? C.accentHl;
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        background: active ? `${color}18` : "rgba(255,255,255,0.03)",
        color: active ? "#fff" : C.muted,
        fontSize: "var(--fs-subtitle)", fontWeight: active ? 700 : 500,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export function SpellChoiceList({ title, caption, spells, chosen, max, onToggle, isAllowed }: {
  title: string;
  caption: string;
  spells: LevelUpSpellSummary[];
  chosen: string[];
  max: number;
  onToggle: (id: string) => void;
  isAllowed?: (spell: LevelUpSpellSummary) => boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
          {chosen.length} / {max} · {caption}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {spells.map((spell) => {
          const active = chosen.includes(spell.id);
          const allowed = isAllowed ? isAllowed(spell) : true;
          const blocked = !active && (chosen.length >= max || !allowed);
          const prerequisite = extractPrerequisite(spell.text);
          const preview = stripPrerequisiteLine(spell.text).replace(/Source:.*$/ms, "").trim();
          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => !blocked && onToggle(spell.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: blocked ? "not-allowed" : "pointer",
                border: `2px solid ${active ? C.accentHl : "rgba(255,255,255,0.1)"}`,
                background: active ? "rgba(56,182,255,0.14)" : "rgba(255,255,255,0.03)",
                color: blocked ? C.muted : C.text,
                textAlign: "left",
                opacity: blocked ? 0.6 : 1,
                minHeight: 92,
              }}
            >
              <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{spell.name}</div>
              {spell.level != null && spell.level > 0 && (
                <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 2 }}>
                  Level {spell.level}
                </div>
              )}
              {prerequisite && (
                <div style={{ marginTop: 6, fontSize: "var(--fs-tiny)", lineHeight: 1.35 }}>
                  <span style={{ color: allowed ? C.colorGold : C.colorPinkRed, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Prerequisite
                  </span>
                  <span style={{ color: allowed ? "rgba(251,191,36,0.92)" : "#fca5a5" }}> {prerequisite}</span>
                </div>
              )}
              {!allowed && prerequisite && (
                <div style={{ marginTop: 4, fontSize: "var(--fs-tiny)", color: C.colorPinkRed, fontWeight: 700 }}>
                  Prerequisite not met
                </div>
              )}
              {preview && (
                <div style={{ marginTop: 6, fontSize: "var(--fs-tiny)", lineHeight: 1.35, color: "rgba(160,180,220,0.72)" }}>
                  {preview.slice(0, 150)}{preview.length > 150 ? "…" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {spells.length === 0 && (
        <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>No eligible options found in compendium.</div>
      )}
    </div>
  );
}

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
          {extractPrerequisite(chosenFeatDetail.text) && (
            <div style={{ fontSize: "var(--fs-small)", color: featPrereqsMet ? C.colorGold : C.colorPinkRed, marginBottom: 8, fontWeight: 700 }}>
              Prerequisite: {extractPrerequisite(chosenFeatDetail.text)}
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
              {stripPrerequisiteLine(chosenFeatDetail.text).replace(/Source:.*$/ms, "").trim()}
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

export function ExpertiseSelectionSection(props: {
  accentColor: string;
  expertiseChoices: LevelUpExpertiseChoice[];
  chosenExpertise: Record<string, string[]>;
  proficientSkills: string[];
  existingExpertise: string[];
  onToggleExpertise: (choiceKey: string, skill: string, count: number) => void;
}) {
  const { accentColor, expertiseChoices, chosenExpertise, proficientSkills, existingExpertise, onToggleExpertise } = props;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {expertiseChoices.map((choice) => {
        const selected = chosenExpertise[choice.key] ?? [];
        const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
        const existingExpertiseKeys = new Set(existingExpertise.map((skill) => normalizeChoiceKey(skill)));
        const options = (choice.options ?? proficientSkills)
          .filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)))
          .filter((skill) => !existingExpertiseKeys.has(normalizeChoiceKey(skill)) || selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill)));
        return (
          <div key={choice.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: "var(--fs-body)", fontWeight: 800, color: "#fff" }}>{choice.source}</div>
              <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? accentColor : C.muted }}>
                {selected.length} / {choice.count}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {options.map((skill) => {
                const isSelected = selected.some((entry) => normalizeChoiceKey(entry) === normalizeChoiceKey(skill));
                const blocked = !isSelected && (selected.length >= choice.count || existingExpertiseKeys.has(normalizeChoiceKey(skill)));
                return (
                  <ChoiceBtn
                    key={skill}
                    active={isSelected}
                    onClick={() => {
                      if (blocked) return;
                      onToggleExpertise(choice.key, skill, choice.count);
                    }}
                    accent={accentColor}
                  >
                    {skill}
                  </ChoiceBtn>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
