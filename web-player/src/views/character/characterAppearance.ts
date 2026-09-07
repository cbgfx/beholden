import type { CSSProperties } from "react";
import type { CharacterAppearance, CharacterBackgroundPattern } from "./CharacterSheetTypes";

export const DEFAULT_BACKGROUND_COLOR = "#0d1525";
export const DEFAULT_PANEL_BACKGROUND_COLOR = "#1a2231";
export const DEFAULT_TEXT_COLOR = "#e8edf5";

export const BACKGROUND_PATTERN_OPTIONS: Array<{ id: CharacterBackgroundPattern; label: string }> = [
  { id: "none", label: "None" }, { id: "runes", label: "Runes" },
  { id: "grid", label: "Grid" }, { id: "stars", label: "Stars" }, { id: "grain", label: "Grain" },
];

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeAppearance(value: CharacterAppearance | null | undefined): Required<CharacterAppearance> {
  return {
    backgroundColor: isHexColor(value?.backgroundColor) ? value!.backgroundColor! : DEFAULT_BACKGROUND_COLOR,
    panelBackgroundColor: isHexColor(value?.panelBackgroundColor) ? value!.panelBackgroundColor! : DEFAULT_PANEL_BACKGROUND_COLOR,
    textColor: isHexColor(value?.textColor) ? value!.textColor! : DEFAULT_TEXT_COLOR,
    backgroundPattern: BACKGROUND_PATTERN_OPTIONS.some((option) => option.id === value?.backgroundPattern) ? value!.backgroundPattern! : "none",
    backgroundIntensity: Math.max(0, Math.min(100, Math.round(Number(value?.backgroundIntensity) || 0))),
  };
}

export function appearanceCssVariables(appearance: CharacterAppearance | null | undefined): CSSProperties {
  const normalized = normalizeAppearance(appearance);
  return {
    "--character-panel-bg": normalized.panelBackgroundColor,
    "--character-panel-border": "rgba(255,255,255,0.09)",
    "--character-panel-radius": "12px",
    "--character-panel-shadow": "none",
    "--character-text-color": normalized.textColor,
  } as CSSProperties;
}

export function backgroundPatternImage(pattern: CharacterBackgroundPattern, color: string, intensity: number): string | undefined {
  const alpha = Math.max(0, Math.min(0.22, intensity / 455));
  if (!alpha || pattern === "none") return undefined;
  if (pattern === "grid") return `linear-gradient(${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")} 1px, transparent 1px), linear-gradient(90deg, ${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")} 1px, transparent 1px)`;
  if (pattern === "stars") return `radial-gradient(circle at 20% 30%, ${color} 0 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, ${color} 0 1px, transparent 1.5px)`;
  if (pattern === "runes") return `repeating-radial-gradient(circle at 50% 20%, transparent 0 28px, color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent) 29px 30px, transparent 31px 58px)`;
  return `repeating-linear-gradient(115deg, color-mix(in srgb, ${color} ${Math.round(alpha * 70)}%, transparent) 0 1px, transparent 1px 5px)`;
}
