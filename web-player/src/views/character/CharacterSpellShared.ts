import React from "react";
import { C } from "@/lib/theme";

export interface FetchedSpellDetail {
  id: string;
  name: string;
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
}

export function parseSpellDamage(text: string): { dice: string; type: string } | null {
  const match = text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(fire|cold|lightning|acid|poison|necrotic|radiant|thunder|psychic|force|bludgeoning|piercing|slashing)\s+damage/i);
  if (!match) return null;
  return { dice: match[1].replace(/\s+/g, ""), type: match[2].toLowerCase() };
}

function parseDiceExpression(expr: string): { count: number; sides: number; bonus: number } | null {
  const match = String(expr ?? "").trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    bonus: parseInt(match[3] ?? "0", 10),
  };
}

function formatDiceExpression(parsed: { count: number; sides: number; bonus: number }): string {
  return `${parsed.count}d${parsed.sides}${parsed.bonus > 0 ? `+${parsed.bonus}` : ""}`;
}

function addScaledDice(baseExpr: string, incrementExpr: string, times: number): string {
  if (times <= 0) return baseExpr.replace(/\s+/g, "");
  const base = parseDiceExpression(baseExpr);
  const increment = parseDiceExpression(incrementExpr);
  if (!base || !increment || base.sides !== increment.sides) return baseExpr.replace(/\s+/g, "");
  return formatDiceExpression({
    count: base.count + (increment.count * times),
    sides: base.sides,
    bonus: base.bonus + (increment.bonus * times),
  });
}

export function highestAvailableSlotLevel(levelSlots: number[] | null | undefined): number {
  if (!levelSlots) return 0;
  for (let i = levelSlots.length - 1; i >= 1; i -= 1) {
    if ((levelSlots[i] ?? 0) > 0) return i;
  }
  return 0;
}

export function getScaledSpellDamage(detail: FetchedSpellDetail, charLevel: number, maxSlotLevel: number): { dice: string; type: string } | null {
  const text = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
  const base = parseSpellDamage(text);
  if (!base) return null;

  if ((detail.level ?? 0) === 0) {
    const tierBoosts = (charLevel >= 5 ? 1 : 0) + (charLevel >= 11 ? 1 : 0) + (charLevel >= 17 ? 1 : 0);
    const cantripBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?)/i);
    if (cantripBoost && tierBoosts > 0) {
      return { ...base, dice: addScaledDice(base.dice, cantripBoost[1], tierBoosts) };
    }
    return base;
  }

  const baseLevel = Math.max(1, detail.level ?? 1);
  const castLevel = Math.max(baseLevel, maxSlotLevel);

  if (/^magic missile$/i.test(detail.name.trim())) {
    const darts = 3 + Math.max(0, castLevel - 1);
    return { dice: `${darts}d4+${darts}`, type: "force" };
  }

  const higherLevelBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?) for each slot level above (\d+)(?:st|nd|rd|th)/i);
  if (higherLevelBoost) {
    const threshold = parseInt(higherLevelBoost[2], 10);
    const times = Math.max(0, castLevel - threshold);
    if (times > 0) {
      return { ...base, dice: addScaledDice(base.dice, higherLevelBoost[1], times) };
    }
  }

  return base;
}

export function parseSpellSave(text: string): string | null {
  const match = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA)\s+saving\s+throw/i);
  if (!match) return null;
  const map: Record<string, string> = {
    strength: "STR",
    dexterity: "DEX",
    constitution: "CON",
    intelligence: "INT",
    wisdom: "WIS",
    charisma: "CHA",
  };
  return map[match[1].toLowerCase()] ?? match[1].toUpperCase().slice(0, 3);
}

export function abbrevTime(time: string): string {
  const base = time.split(/,\s*which\b/i)[0].trim();
  return base
    .replace(/1 bonus action/i, "1BA")
    .replace(/1 action/i, "1A")
    .replace(/1 reaction/i, "1R")
    .replace(/1 minute/i, "1 min");
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
};

export const DMG_EMOJI: Record<string, string> = {
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
