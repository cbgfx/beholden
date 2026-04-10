import React from "react";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type AbilityScoreCellContext = {
  key: AbilityKey;
  label: string;
  rawScore: number | null | undefined;
  score: number;
  modifier: number;
  save: number;
  highlightedSave: boolean;
  compact: boolean;
};

const DEFAULT_LABELS: Record<AbilityKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

const DEFAULT_ORDER: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

function defaultModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function defaultFormatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function toNumber(value: number | null | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function AbilityScoresCompact({
  scores,
  saves,
  compact = false,
  order = DEFAULT_ORDER,
  labels = DEFAULT_LABELS,
  accentColor = "#d978ff",
  mutedColor = "rgba(160,180,220,0.75)",
  textColor = "#e8edf5",
  pillBackground = "rgba(0,0,0,0.28)",
  pillBorderColor = "rgba(255,255,255,0.14)",
  getModifier = defaultModifier,
  formatModifier = defaultFormatModifier,
  minColumnWidth = 180,
  renderLabel,
  renderScore,
  renderMod,
  renderSave,
}: {
  scores: Partial<Record<AbilityKey, number | null | undefined>>;
  saves?: Partial<Record<AbilityKey, number | null | undefined>>;
  compact?: boolean;
  order?: AbilityKey[];
  labels?: Record<AbilityKey, string>;
  accentColor?: string;
  mutedColor?: string;
  textColor?: string;
  pillBackground?: string;
  pillBorderColor?: string;
  getModifier?: (score: number) => number;
  formatModifier?: (value: number) => string;
  minColumnWidth?: number;
  renderLabel?: (context: AbilityScoreCellContext) => React.ReactNode;
  renderScore?: (context: AbilityScoreCellContext) => React.ReactNode;
  renderMod?: (context: AbilityScoreCellContext) => React.ReactNode;
  renderSave?: (context: AbilityScoreCellContext) => React.ReactNode;
}) {
  const midpoint = Math.ceil(order.length / 2);
  const columns = [order.slice(0, midpoint), order.slice(midpoint)];
  const columnGap = compact ? 8 : 16;
  const rowGap = compact ? 5 : 8;
  const cellGap = compact ? 6 : 8;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`, gap: columnGap }}>
      {columns.map((keys, index) => (
        <div key={index} style={{ minWidth: 0, display: "grid", gap: rowGap }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "28px minmax(44px, auto) minmax(24px, auto) minmax(24px, auto)",
              gap: cellGap,
              alignItems: "center",
            }}
          >
            <div />
            <div style={headerStyle(mutedColor)}>Score</div>
            <div style={headerStyle(mutedColor)}>Mod</div>
            <div style={headerStyle(mutedColor)}>Save</div>
          </div>
          {keys.map((key) => {
            const rawScore = scores[key];
            const score = toNumber(rawScore, 10);
            const modifier = getModifier(score);
            const save = saves?.[key] == null ? modifier : toNumber(saves[key], modifier);
            const highlightedSave = save !== modifier;
            const context: AbilityScoreCellContext = {
              key,
              label: labels[key] ?? key.toUpperCase(),
              rawScore,
              score,
              modifier,
              save,
              highlightedSave,
              compact,
            };
            return (
              <div
                key={key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "28px minmax(44px, auto) minmax(24px, auto) minmax(24px, auto)",
                  gap: cellGap,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "var(--fs-small)",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: mutedColor,
                  }}
                >
                  {renderLabel ? renderLabel(context) : context.label}
                </div>
                {renderScore ? (
                  renderScore(context)
                ) : (
                  <div
                    style={{
                      minWidth: 0,
                      textAlign: "center",
                      padding: compact ? "5px 7px" : "6px 8px",
                      borderRadius: 9,
                      border: `1px solid ${pillBorderColor}`,
                      background: pillBackground,
                      color: highlightedSave ? accentColor : textColor,
                      fontSize: "var(--fs-subtitle)",
                      fontWeight: 900,
                      fontVariantNumeric: "tabular-nums",
                      lineHeight: 1.1,
                    }}
                  >
                    {score}
                  </div>
                )}
                {renderMod ? (
                  renderMod(context)
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: textColor,
                      fontSize: "var(--fs-subtitle)",
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatModifier(modifier)}
                  </div>
                )}
                {renderSave ? (
                  renderSave(context)
                ) : (
                  <div
                    style={{
                      textAlign: "center",
                      color: highlightedSave ? accentColor : textColor,
                      fontSize: "var(--fs-subtitle)",
                      fontWeight: 800,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatModifier(save)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function headerStyle(mutedColor: string): React.CSSProperties {
  return {
    textAlign: "center",
    color: mutedColor,
    fontSize: "var(--fs-tiny)",
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  };
}
