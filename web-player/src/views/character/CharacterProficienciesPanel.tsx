import React from "react";
import { C } from "@/lib/theme";
import { CollapsiblePanel, Tooltip } from "@/views/character/CharacterViewParts";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { formatWeaponProficiencyName } from "@/views/character/CharacterInventory";
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
    { label: "Armor", items: prof.armor, color: C.colorMagic },
    { label: "Weapons", items: prof.weapons, color: C.colorPinkRed },
    { label: "Maneuvers", items: prof.maneuvers, color: C.accentHl },
    { label: "Metamagic", items: prof.metamagic, color: C.accentHl },
    { label: "Magic Item Plans", items: prof.plans, color: C.colorRitual },
    { label: "Tools", items: allToolNames.map((name) => ({ name, source: hasEntry(customTools, name) ? "Custom" : (prof.tools.find((entry) => normalize(entry.name) === normalize(name))?.source ?? "Class/Feature"), isCustom: hasEntry(customTools, name) })), color: C.colorOrange },
    { label: "Expertise", items: prof.expertise, color: accentColor },
    { label: "Languages", items: allLanguageNames.map((name) => ({ name, source: hasEntry(customLanguages, name) ? "Custom" : (prof.languages.find((entry) => normalize(entry.name) === normalize(name))?.source ?? "Class/Feature"), isCustom: hasEntry(customLanguages, name) })), color: C.colorRitual },
  ].filter((s) => s.items.length > 0 || s.label === "Tools" || s.label === "Languages");
  if (!sections.length) return null;
  return (
    <CollapsiblePanel
      title="Proficiencies &amp; Languages"
      color={accentColor}
      storageKey="proficiencies"
      summary={`${allToolNames.length} tools · ${allLanguageNames.length} languages`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sections.map((s) => (
          <div key={s.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {s.label}
              </div>
              {s.label === "Tools" && !addingTools && availableTools.length > 0 ? (
                <button
                  onClick={() => setAddingTools(true)}
                  style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-small)", color: accentColor, fontWeight: 800, lineHeight: 1 }}
                  title="Add tool"
                >
                  +
                </button>
              ) : null}
              {s.label === "Languages" && !addingLanguages && availableLanguages.length > 0 ? (
                <button
                  onClick={() => setAddingLanguages(true)}
                  style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-small)", color: accentColor, fontWeight: 800, lineHeight: 1 }}
                  title="Add language"
                >
                  +
                </button>
              ) : null}
            </div>
            {s.label === "Tools" && addingTools ? (
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
                  <option value="" disabled>Select tool...</option>
                  {availableTools.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            ) : null}
            {s.label === "Languages" && addingLanguages ? (
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
                  <option value="" disabled>Select language...</option>
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
                    {s.label === "Weapons" ? formatWeaponProficiencyName(item.name) : item.name}
                    {("isCustom" in item && item.isCustom) ? (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (s.label === "Tools") onCustomToolsChange(customTools.filter((entry) => normalize(entry) !== normalize(item.name)));
                          if (s.label === "Languages") onCustomLanguagesChange(customLanguages.filter((entry) => normalize(entry) !== normalize(item.name)));
                        }}
                        style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1, marginLeft: 2 }}
                        title="Remove"
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
