import { theme } from "@/theme/theme";
import type { Combatant } from "@/domain/types/domain";
import type { Player } from "@/domain/types/domain";

export function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function getHudNames(c: any, playersById: Record<string, any>) {
  if (!c) return { primary: "—", secondary: null as string | null };

  const baseType = c.baseType;
  const baseName = c.name.trim();
  const label = (c.label || baseName).trim();

  if (baseType === "player") {
    const p = playersById?.[c.baseId];
    const playerName = (p?.playerName ?? "").trim();
    return { primary: label || "—", secondary: playerName ? `(${playerName})` : null };
  }

  // Monster / iNPC: show Label (BaseName) when label differs from base name
  if (baseName && label && baseName.toLowerCase() !== label.toLowerCase()) {
    return { primary: label, secondary: `(${baseName})` };
  }

  return { primary: label || baseName || "—", secondary: null };
}

export function getHudHp(c: Combatant | null) {
  const hpCurrent = Number(c?.hpCurrent ?? 0) || 0;
  const baseHpMax = Number(c?.hpMax ?? 0) || 0;
  const hpMod = Number(c?.overrides?.hpMaxOverride ?? 0) || 0;
  const hpMax = Math.max(1, baseHpMax + hpMod);
  const tempHp = Math.max(0, Number(c?.overrides?.tempHp ?? 0) || 0);
  return { hpCurrent, hpMax: Math.max(1, hpMax || 1), tempHp };
}

export function getHudHpFill(hpPct: number) {
  // HUD HP color cues: green -> orange (<= 1/2) -> red (<= 1/4)
  return hpPct <= 0.25 ? theme.colors.red : hpPct <= 0.5 ? theme.colors.bloody : theme.colors.green;
}
