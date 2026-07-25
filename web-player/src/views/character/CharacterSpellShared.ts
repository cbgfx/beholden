import React from "react";
import { C } from "@/lib/theme";

export interface FetchedSpellDetail {
  id: string;
  name: string;
  ruleset?: "5e" | "5.5e";
  source?: string | null;
  level: number | null;
  school?: string | null;
  time?: string | null;
  range?: string | null;
  duration?: string | null;
  ritual?: boolean;
  concentration?: boolean;
  components?: string | null;
  text?: string | string[];
  classes?: string | null;
  damage?: { dice: string; type: string } | null;
  save?: string | null;
  check?: string | null;
  rolls?: Array<{ formula: string; effect?: string | string[] | null; level?: number | null }>;
}

export const SPELL_ROW_GRID_WITH_MARKER = "24px minmax(0, 1fr) 108px 68px 92px";
export const SPELL_ROW_GRID = "minmax(0, 1fr) 108px 68px 92px";

export const spellColumnHeaderStyle: React.CSSProperties = {
  minWidth: 0,
  color: C.muted,
  fontSize: "var(--fs-tiny)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.07em",
};

export function highestAvailableSlotLevel(levelSlots: number[] | null | undefined): number {
  if (!levelSlots) return 0;
  for (let i = levelSlots.length - 1; i >= 1; i -= 1) {
    if ((levelSlots[i] ?? 0) > 0) return i;
  }
  return 0;
}

export function getScaledSpellDamage(
  detail: FetchedSpellDetail,
  charLevel: number,
  maxSlotLevel: number,
  spellMod?: number,
): { dice: string; type: string; types: string[] } | null {
  const damageTypes = new Set(Object.keys(DMG_COLORS));
  const rolls = (detail.rolls ?? []).filter((roll) => {
    const effects = Array.isArray(roll.effect) ? roll.effect : [roll.effect];
    return effects.some((effect) => effect && damageTypes.has(effect));
  });
  if (!rolls.length) return null;
  // Cantrip rows scale by character level (their `level` is the tier threshold, e.g. 5/11/17) —
  // take the highest tier reached. Leveled spells' rows are slot-keyed (the level they're cast or
  // upcast at) — take the row for the target slot level, never just the last (highest) authored
  // row, or a base-level display would show the spell's max upcast instead of its base roll.
  const targetLevel = detail.level === 0 ? charLevel : (maxSlotLevel || detail.level || 0);
  const eligible = rolls.filter((roll) => (roll.level ?? detail.level ?? 0) <= targetLevel);
  const roll = eligible.at(-1) ?? rolls[0];
  const types = (Array.isArray(roll.effect) ? roll.effect : [roll.effect]).filter((effect): effect is string => Boolean(effect));
  // A handful of healing rolls (Healing Word, Cure Wounds, ...) are authored with a literal
  // "SPELL" token meaning "add the caster's spellcasting ability modifier" — no roll parser
  // anywhere resolves that token, so it was rendering to the player as literal, meaningless text.
  // Substitute the real number here rather than leaving it for a dice-expression parser to choke on.
  const hasSpellMod = /SPELL/i.test(roll.formula);
  const dice = hasSpellMod
    ? `${roll.formula.replace(/[+-]?SPELL/gi, "")}${spellMod == null ? "" : `${spellMod >= 0 ? "+" : ""}${spellMod}`}`
    : roll.formula;
  return { dice, type: types[0] ?? "", types };
}

export function abbrevTime(time: string): string {
  return time
    .split(/,\s*which\b/i)[0].trim()
    .replace(/bonus action/i, "Bonus")
    .replace(/(\d+)\s+minute/i, "$1 min");
}

export function grantedSpellChargeBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 999,
    padding: 0,
    cursor: enabled ? "pointer" : "not-allowed",
    border: "1px solid rgba(255,255,255,0.12)",
    background: enabled ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.03)",
    color: enabled ? C.text : C.muted,
    fontWeight: 800,
  };
}

export function spellSectionHeaderBtn(borderColor: string, marginBottom = 8): React.CSSProperties {
  return {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 0 5px",
    marginBottom,
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${borderColor}`,
    cursor: "pointer",
    textAlign: "left",
  };
}

export function spellSectionArrow(collapsed: boolean, color: string): React.CSSProperties {
  return {
    color,
    fontSize: "var(--fs-tiny)",
    lineHeight: 1,
    transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
    transition: "transform 120ms ease",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 10,
    flexShrink: 0,
  };
}

export const DMG_COLORS: Record<string, string> = {
  fire: "#f97316",
  cold: C.colorRitual,
  lightning: "#facc15",
  acid: "#a3e635",
  poison: "#86efac",
  necrotic: "#818cf8",
  radiant: "#fde68a",
  thunder: "#7dd3fc",
  psychic: "#e879f9",
  force: C.colorMagic,
  bludgeoning: "#94a3b8",
  piercing: "#94a3b8",
  slashing: C.colorPinkRed,
  healing: "#4ade80",
  temp_hp: "#60a5fa",
};

export const DMG_EMOJI: Record<string, string> = {
  healing: "♥",
  temp_hp: "◇",
  fire: "🔥",
  cold: "❄️",
  lightning: "⚡",
  acid: "🧪",
  poison: "☠️",
  necrotic: "💀",
  radiant: "✨",
  thunder: "💥",
  psychic: "🔮",
  force: "◆",
};

export const LEVEL_LABELS: Record<number, string> = {
  0: "Cantrip",
  1: "1st Level",
  2: "2nd Level",
  3: "3rd Level",
  4: "4th Level",
  5: "5th Level",
  6: "6th Level",
  7: "7th Level",
  8: "8th Level",
  9: "9th Level",
};
