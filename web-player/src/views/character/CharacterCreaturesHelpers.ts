import { C, withAlpha } from "@/lib/theme";

export function creatureHpPill(current: number, max: number): React.CSSProperties {
  const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  const color = ratio <= 0.25 ? C.red : ratio <= 0.6 ? C.colorGold : C.green;
  return {
    borderRadius: 999,
    padding: "2px 8px",
    border: `1px solid ${withAlpha(color, 0.28)}`,
    background: withAlpha(color, 0.12),
    color,
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  };
}

export function creatureRoundPill(color: string): React.CSSProperties {
  return {
    width: 24,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${C.panelBorder}`,
    background: "transparent",
    color,
    cursor: "pointer",
    fontWeight: 900,
    flexShrink: 0,
  };
}

export function formatCreatureMonsterSource(monsterId: string | undefined): string | null {
  if (!monsterId) return null;
  const trimmed = monsterId.replace(/^m_/, "").replace(/[_-]+/g, " ").trim();
  return trimmed || null;
}

export function creatureAcPill(accentColor: string): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: "2px 8px",
    border: `1px solid ${withAlpha(accentColor, 0.28)}`,
    background: withAlpha(accentColor, 0.12),
    color: accentColor,
    fontSize: "var(--fs-small)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  };
}
