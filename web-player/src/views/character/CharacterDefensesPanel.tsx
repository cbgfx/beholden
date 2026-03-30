import React, { useState } from "react";
import { C } from "@/lib/theme";
import { CollapsiblePanel } from "@/views/character/CharacterViewParts";

const DAMAGE_TYPE_OPTIONS = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
  "Necrotic", "Piercing", "Poison", "Psychic", "Radiant",
  "Slashing", "Thunder", "Nonmagical B/P/S",
];

interface DefenseRowProps {
  label: string;
  color: string;
  items: string[];
  customItems: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  accentColor: string;
}

function DefenseRow({ label, color, items, customItems, onAdd, onRemove, accentColor }: DefenseRowProps) {
  const [adding, setAdding] = useState(false);
  const allItems = Array.from(new Set([...items, ...customItems]));

  const remaining = DAMAGE_TYPE_OPTIONS.filter((o) => !allItems.includes(o));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted }}>
          {label}
        </span>
        {!adding && remaining.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-small)", color: accentColor, fontWeight: 800, lineHeight: 1 }}
            title={`Add ${label.toLowerCase()}`}
          >
            +
          </button>
        )}
      </div>
      {adding && (
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
              const val = e.target.value;
              if (val) { onAdd(val); setAdding(false); }
            }}
            onBlur={() => setAdding(false)}
          >
            <option value="" disabled>Select type…</option>
            {remaining.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )}
      {allItems.length === 0 ? (
        <span style={{ fontSize: "var(--fs-small)", color: C.muted, fontStyle: "italic" }}>None</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {allItems.map((item) => {
            const isCustom = customItems.includes(item);
            return (
              <span
                key={item}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: "var(--fs-small)", fontWeight: 700,
                  color: color,
                  background: `${color}18`,
                  border: `1px solid ${color}44`,
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                {item}
                {isCustom && (
                  <button
                    onClick={() => onRemove(item)}
                    style={{ all: "unset", cursor: "pointer", fontSize: "var(--fs-tiny)", color: C.muted, lineHeight: 1, marginLeft: 2 }}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ReadonlyTagRowProps {
  label: string;
  color: string;
  items: string[];
}

function ReadonlyTagRow({ label, color, items }: ReadonlyTagRowProps) {
  return (
    <div>
      <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, marginBottom: 5 }}>
        {label}
      </div>
      {items.length === 0 ? (
        <span style={{ fontSize: "var(--fs-small)", color: C.muted, fontStyle: "italic" }}>None</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {items.map((item) => (
            <span
              key={item}
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: "var(--fs-small)",
                fontWeight: 700,
                color,
                background: `${color}18`,
                border: `1px solid ${color}44`,
                borderRadius: 999,
                padding: "2px 8px",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export interface CharacterDefensesPanelProps {
  resistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  senses: string[];
  customResistances: string[];
  customImmunities: string[];
  accentColor: string;
  onCustomResistancesChange: (values: string[]) => void;
  onCustomImmunitiesChange: (values: string[]) => void;
}

export function CharacterDefensesPanel({
  resistances,
  damageImmunities,
  conditionImmunities,
  senses,
  customResistances,
  customImmunities,
  accentColor,
  onCustomResistancesChange,
  onCustomImmunitiesChange,
}: CharacterDefensesPanelProps) {
  const hasAnything = resistances.length > 0 || damageImmunities.length > 0 || conditionImmunities.length > 0 ||
    senses.length > 0 || customResistances.length > 0 || customImmunities.length > 0;

  // Always render the panel so users can add custom ones
  void hasAnything;

  return (
    <CollapsiblePanel title="Defenses" color={accentColor} storageKey="defenses">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DefenseRow
          label="Resistances"
          color="#34d399"
          items={resistances}
          customItems={customResistances}
          accentColor={accentColor}
          onAdd={(v) => onCustomResistancesChange([...customResistances, v])}
          onRemove={(v) => onCustomResistancesChange(customResistances.filter((x) => x !== v))}
        />
        <DefenseRow
          label="Damage Immunities"
          color={C.colorRitual}
          items={damageImmunities}
          customItems={customImmunities}
          accentColor={accentColor}
          onAdd={(v) => onCustomImmunitiesChange([...customImmunities, v])}
          onRemove={(v) => onCustomImmunitiesChange(customImmunities.filter((x) => x !== v))}
        />
        <ReadonlyTagRow
          label="Condition Immunities"
          color={C.colorOrange}
          items={conditionImmunities}
        />
        <ReadonlyTagRow
          label="Senses"
          color={C.colorGold}
          items={senses}
        />
      </div>
    </CollapsiblePanel>
  );
}
