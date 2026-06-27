import { C, withAlpha } from "@/lib/theme";
import type { PreparedSpellProgressionTable } from "@/types/preparedSpellProgression";
import type { ClassFeatureEntry } from "@/views/character/CharacterSheetTypes";

export function PreparedSpellProgressionBlock(props: {
  tables: PreparedSpellProgressionTable[];
  accentColor?: string;
  compact?: boolean;
}) {
  const { tables, accentColor = C.accentHl, compact = false } = props;
  if (!tables.length) return null;

  return (
    <div style={{ marginTop: compact ? 8 : 10, display: "flex", flexDirection: "column", gap: compact ? 8 : 10 }}>
      {tables.map((table, tableIndex) => (
        <div
          key={`${table.label ?? "default"}:${table.levelLabel}:${table.spellLabel}:${tableIndex}`}
          style={{
            borderRadius: 8,
            border: `1px solid ${withAlpha(accentColor, 0.22)}`,
            background: withAlpha(accentColor, 0.06),
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: compact ? "6px 8px" : "7px 10px",
              borderBottom: `1px solid ${withAlpha(accentColor, 0.18)}`,
              color: accentColor,
              fontSize: "var(--fs-small)",
              fontWeight: 800,
            }}
          >
            {table.label?.trim() || "Prepared Spells"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(82px, auto) minmax(0, 1fr)" }}>
            <div
              style={{
                padding: compact ? "6px 8px" : "7px 10px",
                borderRight: `1px solid ${withAlpha(accentColor, 0.16)}`,
                color: C.muted,
                fontSize: "var(--fs-small)",
                fontWeight: 700,
              }}
            >
              {table.levelLabel}
            </div>
            <div style={{ padding: compact ? "6px 8px" : "7px 10px", color: C.muted, fontSize: "var(--fs-small)", fontWeight: 700 }}>
              {table.spellLabel}
            </div>
          </div>
          {table.rows.map((row) => (
            <div
              key={`${table.label ?? "default"}:${row.level}:${row.spells.join("|")}`}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(82px, auto) minmax(0, 1fr)",
                borderTop: `1px solid ${withAlpha(accentColor, 0.12)}`,
              }}
            >
              <div
                style={{
                  padding: compact ? "6px 8px" : "7px 10px",
                  borderRight: `1px solid ${withAlpha(accentColor, 0.12)}`,
                  color: C.text,
                  fontSize: "var(--fs-small)",
                  fontWeight: 700,
                }}
              >
                {row.level}
              </div>
              <div style={{ padding: compact ? "6px 8px" : "7px 10px", color: C.text, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>
                {row.spells.join(", ")}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ClassFeatureItem(props: {
  feature: ClassFeatureEntry;
  expanded: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  const { feature, expanded, accentColor } = props;
  return (
    <div style={{
      padding: "5px 6px",
      borderRadius: 7,
      background: expanded ? withAlpha(accentColor, 0.07) : "transparent",
      border: `1px solid ${expanded ? withAlpha(accentColor, 0.22) : "transparent"}`,
    }}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          fontWeight: 700,
          color: C.text,
          fontSize: "var(--fs-subtitle)",
          lineHeight: 1.4,
        }}
      >
        {feature.name}
      </button>
      {expanded && feature.text && (
        <div style={{ marginTop: 6, color: C.muted, fontSize: "var(--fs-small)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {feature.text}
        </div>
      )}
      {expanded && feature.preparedSpellProgression?.length ? (
        <PreparedSpellProgressionBlock tables={feature.preparedSpellProgression} accentColor={accentColor} />
      ) : null}
    </div>
  );
}
