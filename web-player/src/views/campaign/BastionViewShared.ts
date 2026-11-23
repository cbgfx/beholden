import type { CompendiumFacility } from "@beholden/shared/api/bastions";
import type { CSSProperties } from "react";
import { C } from "@/lib/theme";

export function sortFacilitiesByLevelThenName(facilities: CompendiumFacility[]): CompendiumFacility[] {
  return [...facilities].sort((a, b) => {
    const levelDelta = (a.minimumLevel ?? 0) - (b.minimumLevel ?? 0);
    if (levelDelta !== 0) return levelDelta;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

export function ghostButtonStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 11px",
    borderRadius: 8,
    border: `1px solid rgba(251,191,36,0.35)`,
    background: "rgba(251,191,36,0.10)",
    color: C.colorGold,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 700,
  };
}

export function accentButtonStyle(enabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 14px",
    borderRadius: 8,
    border: "none",
    background: enabled ? C.colorGold : "rgba(255,255,255,0.08)",
    color: enabled ? C.textDark : C.muted,
    cursor: enabled ? "pointer" : "not-allowed",
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    transition: "background 120ms ease",
  };
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: `1px solid ${C.panelBorder}`,
  background: "rgba(0,0,0,0.30)",
  color: C.text,
  fontSize: "var(--fs-small)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
