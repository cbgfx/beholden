import React from "react";
import { C } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import { labelStyle, profChipStyle, sourceTagStyle } from "../shared/CharacterCreatorStyles";

export interface Step5ClassFeatChoiceLike {
  featureName: string;
  featGroup: string;
  options: Array<{ id: string; name: string }>;
}

export function collectPreparedSpellProgressionTables(
  entries: Array<{ preparedSpellProgression?: PreparedSpellProgressionTable[] }>
): PreparedSpellProgressionTable[] {
  const seen = new Set<string>();
  const collected: PreparedSpellProgressionTable[] = [];
  for (const entry of entries) {
    for (const table of entry.preparedSpellProgression ?? []) {
      const key = JSON.stringify(table);
      if (seen.has(key)) continue;
      seen.add(key);
      collected.push(table);
    }
  }
  return collected;
}

export function renderChoiceChipGroup({
  title,
  sourceLabel,
  sourceStyle,
  selectedCount,
  maxCount,
  fixedGrants = [],
  options,
  isSelected,
  isLocked,
  onToggle,
  note,
}: {
  title: string;
  sourceLabel?: string | null;
  sourceStyle?: React.CSSProperties;
  selectedCount: number;
  maxCount: number;
  fixedGrants?: string[];
  options: string[];
  isSelected: (value: string) => boolean;
  isLocked: (value: string, selected: boolean) => boolean;
  onToggle: (value: string) => void;
  note?: string | null;
}): React.ReactNode {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {title}
          {sourceLabel ? <span style={sourceStyle ?? sourceTagStyle}> {sourceLabel}</span> : null}
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: selectedCount >= maxCount ? C.accentHl : C.muted }}>
          {selectedCount} / {maxCount}
        </span>
      </div>
      {fixedGrants.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {fixedGrants.map((grant) => (
            <span key={`${title}:${sourceLabel ?? "none"}:${grant}`} style={profChipStyle}>{grant}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto", padding: "2px 0" }}>
        {options.map((option) => {
          const selected = isSelected(option);
          const locked = isLocked(option, selected);
          return (
            <button
              key={option}
              type="button"
              disabled={locked}
              onClick={() => onToggle(option)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: "var(--fs-subtitle)",
                cursor: locked ? "default" : "pointer",
                border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                color: selected ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                fontWeight: selected ? 700 : 400,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      {note ? <div style={{ color: C.muted, fontSize: "var(--fs-small)", marginTop: 8 }}>{note}</div> : null}
    </div>
  );
}

export function renderClassFeatSingleChoicePanel({
  choice,
  selectedId,
  getChoiceLabel,
  getOptionLabel,
  onSelect,
}: {
  choice: Step5ClassFeatChoiceLike;
  selectedId: string;
  getChoiceLabel: (featGroup: string) => string;
  getOptionLabel: (optionName: string, featGroup: string) => string;
  onSelect: (id: string) => void;
}): React.ReactNode {
  return (
    <div key={choice.featureName} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ ...labelStyle, margin: 0 }}>
          {getChoiceLabel(choice.featGroup)} <span style={sourceTagStyle}>{choice.featureName}</span>
        </div>
        <span style={{ fontSize: "var(--fs-small)", color: selectedId ? C.accentHl : C.muted }}>
          {selectedId ? "1 / 1" : "Required"}
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {choice.options.map((option) => {
          const selected = selectedId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: "var(--fs-subtitle)",
                cursor: "pointer",
                border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                color: selected ? C.accentHl : C.text,
                fontWeight: selected ? 700 : 400,
              }}
            >
              {getOptionLabel(option.name, choice.featGroup)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
