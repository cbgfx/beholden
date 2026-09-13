import React from "react";
import { useTranslation } from "react-i18next";
import { C } from "@/lib/theme";
import { CollapsiblePanel, Tooltip } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { formatWeaponProficiencyName } from "@/views/character/inventory/CharacterInventory";
import { ALL_LANGUAGES, ALL_TOOLS } from "@/views/character-creator/constants/CharacterCreatorConstants";

export function CharacterProficienciesPanel({
  prof,
  accentColor,
  customTools,
  customLanguages,
  onCustomToolsChange,
  onCustomLanguagesChange,
}: {
  prof: ProficiencyMap | null | undefined;
  accentColor: string;
  customTools: string[];
  customLanguages: string[];
  onCustomToolsChange: (values: string[]) => void;
  onCustomLanguagesChange: (values: string[]) => void;
}) {
  const { t } = useTranslation();
  const [addingTools, setAddingTools] = React.useState(false);
  const [addingLanguages, setAddingLanguages] = React.useState(false);
  if (!prof) return null;
  const normalize = (value: string) => value.trim().toLowerCase();
  const hasEntry = (values: string[], value: string) => values.some((entry) => normalize(entry) === normalize(value));
  const baseTools = prof.tools.map((entry) => entry.name);
  const baseLanguages = prof.languages.map((entry) => entry.name);
  const allToolNames = Array.from(new Set([...baseTools, ...customTools]));
  const allLanguageNames = Array.from(new Set([...baseLanguages, ...customLanguages]));
  const availableTools = ALL_TOOLS.filter((name) => !hasEntry(allToolNames, name));
  const availableLanguages = ALL_LANGUAGES.filter((name) => !hasEntry(allLanguageNames, name));
  const sections = [
    { key: "armor", label: t("proficienciesPanel.armor"), items: prof.armor, color: C.colorMagic },
    { key: "weapons", label: t("proficienciesPanel.weapons"), items: prof.weapons, color: C.colorPinkRed },
    { key: "maneuvers", label: t("proficienciesPanel.maneuvers"), items: prof.maneuvers, color: C.accentHl },
    { key: "metamagic", label: t("proficienciesPanel.metamagic"), items: prof.metamagic, color: C.accentHl },
    { key: "infusions", label: t("proficienciesPanel.infusions"), items: prof.infusions, color: C.accentHl },
    { key: "plans", label: t("proficienciesPanel.magicItemPlans"), items: prof.plans, color: C.colorRitual },
    { key: "tools", label: t("proficienciesPanel.tools"), items: allToolNames.map((name) => ({ name, source: hasEntry(customTools, name) ? t("proficienciesPanel.custom") : (prof.tools.find((entry) => normalize(entry.name) === normalize(name))?.source ?? t("proficienciesPanel.classFeature")), isCustom: hasEntry(customTools, name) })), color: C.colorOrange },
    { key: "expertise", label: t("proficienciesPanel.expertise"), items: prof.expertise, color: accentColor },
    { key: "languages", label: t("proficienciesPanel.languages"), items: allLanguageNames.map((name) => ({ name, source: hasEntry(customLanguages, name) ? t("proficienciesPanel.custom") : (prof.languages.find((entry) => normalize(entry.name) === normalize(name))?.source ?? t("proficienciesPanel.classFeature")), isCustom: hasEntry(customLanguages, name) })), color: C.colorRitual },
  ].filter((s) => s.items.length > 0 || s.key === "tools" || s.key === "languages");
  if (!sections.length) return null;
  return (
    <CollapsiblePanel
      title={t("proficienciesPanel.title")}
      color={accentColor}
      storageKey={PANEL_IDS.proficiencies}
      summary={t("proficienciesPanel.summary", { toolCount: allToolNames.length, languageCount: allLanguageNames.length })}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sections.map((s) => (
          <div key={s.key}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {s.label}
              </div>
              {s.key === "tools" && !addingTools && availableTools.length > 0 ? (
                <button
                  onClick={() => setAddingTools(true)}
                  style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-small)", color: accentColor, fontWeight: 800, lineHeight: 1 }}
                  title={t("proficienciesPanel.addTool")}
                >
                  +
                </button>
              ) : null}
              {s.key === "languages" && !addingLanguages && availableLanguages.length > 0 ? (
                <button
                  onClick={() => setAddingLanguages(true)}
                  style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-small)", color: accentColor, fontWeight: 800, lineHeight: 1 }}
                  title={t("proficienciesPanel.addLanguage")}
                >
                  +
                </button>
              ) : null}
            </div>
            {s.key === "tools" && addingTools ? (
              <div style={{ marginBottom: 6 }}>
                <select
                  autoFocus
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 6,
                    color: C.text,
                    fontSize: "var(--fs-small)",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    onCustomToolsChange([...customTools, value]);
                    setAddingTools(false);
                  }}
                  onBlur={() => setAddingTools(false)}
                >
                  <option value="" disabled>{t("proficienciesPanel.selectTool")}</option>
                  {availableTools.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {s.key === "languages" && addingLanguages ? (
              <div style={{ marginBottom: 6 }}>
                <select
                  autoFocus
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 6,
                    color: C.text,
                    fontSize: "var(--fs-small)",
                    padding: "3px 6px",
                    cursor: "pointer",
                  }}
                  defaultValue=""
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    onCustomLanguagesChange([...customLanguages, value]);
                    setAddingLanguages(false);
                  }}
                  onBlur={() => setAddingLanguages(false)}
                >
                  <option value="" disabled>{t("proficienciesPanel.selectLanguage")}</option>
                  {availableLanguages.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {s.items.map((item, i) => (
                <Tooltip key={i} text={item.source}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "var(--fs-small)",
                      padding: "3px 9px",
                      borderRadius: 5,
                      cursor: "default",
                      background: s.color + "18",
                      border: `1px solid ${s.color}44`,
                      color: s.color,
                      fontWeight: 600,
                    }}
                  >
                    {s.key === "weapons" ? formatWeaponProficiencyName(item.name) : item.name}
                    {("isCustom" in item && item.isCustom) ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (s.key === "tools") onCustomToolsChange(customTools.filter((entry) => normalize(entry) !== normalize(item.name)));
                          if (s.key === "languages") onCustomLanguagesChange(customLanguages.filter((entry) => normalize(entry) !== normalize(item.name)));
                        }}
                        style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1, marginLeft: 2 }}
                        title={t("proficienciesPanel.remove")}
                      >
                        x
                      </button>
                    ) : null}
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
