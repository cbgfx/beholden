import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { titleCase } from "@/lib/format/titleCase";
import { ordinal } from "@/lib/format/ordinal";
import { MonsterSectionPanel } from "@/components/MonsterDisplay/MonsterSectionPanel";

function parseSlotCounts(raw: unknown): Record<number, number> {
  const result: Record<number, number> = {};
  if (!raw) return result;
  const str = Array.isArray(raw) ? raw.join(",") : String(raw);
  str.split(",").forEach((part, i) => {
    if (i === 0) return;
    const n = parseInt(part.trim(), 10);
    if (n > 0) result[i] = n;
  });
  return result;
}

function SlotDots({
  total,
  used,
  onChange,
}: {
  total: number;
  used: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => {
        const spent = i >= total - used;
        return (
          <button
            key={i}
            title={spent ? "Slot used - click to restore" : "Click to expend slot"}
            onClick={(e) => {
              e.stopPropagation();
              onChange(spent ? used - 1 : used + 1);
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: spent ? withAlpha(theme.colors.accentPrimary, 0.2) : theme.colors.accentPrimary,
              border: `1.5px solid ${theme.colors.accentPrimary}`,
              transition: "background 150ms ease",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

export function MonsterSpells(props: {
  spellNames: string[];
  spellLevels?: Record<string, number | null>;
  onOpenSpell: (name: string) => void;
  slots?: unknown;
  usedSpellSlots?: Record<string, number>;
  onChangeSpellSlots?: (level: number, used: number) => void;
}) {
  if (!props.spellNames.length) return null;

  const slotCounts = React.useMemo(() => parseSlotCounts(props.slots), [props.slots]);
  const hasSlots = Object.keys(slotCounts).length > 0;

  const grouped = React.useMemo(() => {
    const byLevel = new Map<number, string[]>();
    const unknown: string[] = [];
    for (const raw of props.spellNames) {
      const key = raw.trim().toLowerCase();
      const lvl = props.spellLevels ? props.spellLevels[key] : null;
      if (typeof lvl === "number" && Number.isFinite(lvl)) {
        if (!byLevel.has(lvl)) byLevel.set(lvl, []);
        byLevel.get(lvl)!.push(raw);
      } else {
        unknown.push(raw);
      }
    }

    const levels = Array.from(byLevel.keys()).sort((a, b) => a - b);
    const sections = levels.map((level) => ({
      level,
      title: level === 0 ? "Cantrips" : `${ordinal(level)} level`,
      spells: [...(byLevel.get(level) ?? [])].sort((a, b) => a.localeCompare(b)),
    }));

    if (unknown.length) {
      sections.push({ level: 99, title: "Other", spells: [...unknown].sort((a, b) => a.localeCompare(b)) });
    }

    return sections;
  }, [props.spellNames, props.spellLevels]);

  return (
    <MonsterSectionPanel title="Spells">
      <div style={{ display: "grid", gap: 10 }}>
        {grouped.map((sec) => {
          const totalSlots = slotCounts[sec.level] ?? 0;
          const usedSlots = hasSlots && totalSlots > 0
            ? Math.min(totalSlots, props.usedSpellSlots?.[String(sec.level)] ?? 0)
            : 0;

          return (
            <div key={sec.title} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 900 }}>
                  {sec.title}
                </div>
                {totalSlots > 0 && props.onChangeSpellSlots ? (
                  <SlotDots total={totalSlots} used={usedSlots} onChange={(n) => props.onChangeSpellSlots!(sec.level, n)} />
                ) : null}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {sec.spells.map((s) => (
                  <button
                    key={`${sec.title}:${s}`}
                    onClick={() => props.onOpenSpell(s)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${theme.colors.panelBorder}`,
                      background: theme.colors.panelBg,
                      color: theme.colors.text,
                      fontSize: "var(--fs-pill)",
                      fontWeight: 900,
                    }}
                  >
                    {titleCase(s)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </MonsterSectionPanel>
  );
}
