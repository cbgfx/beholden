import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import type { MonsterDetail } from "@/views/CombatView/types";
import { ActionRow } from "@/views/CombatView/components/ActionRow";
import { MonsterSectionPanel } from "@/components/MonsterDisplay/MonsterSectionPanel";

function parseLegendaryResistanceCount(name: string): number {
  const m = name.match(/\((\d+)\s*\/\s*day\)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return n;
  }
  return 3;
}

function ResistanceDots({
  total,
  used,
  onChange,
}: {
  total: number;
  used: number;
  onChange: (n: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {Array.from({ length: total }).map((_, i) => {
        const spent = i >= total - used;
        return (
          <button
            key={i}
            title={spent ? "Spent - click to restore one" : "Click to spend one legendary resistance"}
            onClick={() => onChange(spent ? used - 1 : used + 1)}
            style={{
              all: "unset",
              cursor: "pointer",
              width: 13,
              height: 13,
              borderRadius: "50%",
              background: spent ? withAlpha(theme.colors.accentPrimary, 0.25) : theme.colors.accentPrimary,
              border: `2px solid ${theme.colors.accentPrimary}`,
              transition: "background 150ms ease",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

export function MonsterTraits(props: {
  monster: MonsterDetail;
  usedLegendaryResistances?: number;
  onChangeLegendaryResistancesUsed?: (n: number) => void;
}) {
  const allTraits = Array.isArray(props.monster.trait) ? props.monster.trait : [];
  const legendaryResistanceTrait = allTraits.find((t) => /legendary resistance/i.test(String(t?.name ?? "")));
  const otherTraits = allTraits.filter((t) => !/legendary resistance/i.test(String(t?.name ?? "")));

  const resistanceCount = legendaryResistanceTrait
    ? parseLegendaryResistanceCount(String(legendaryResistanceTrait.name ?? ""))
    : 0;

  const resistanceText = legendaryResistanceTrait
    ? (Array.isArray(legendaryResistanceTrait.text)
        ? legendaryResistanceTrait.text.map(String).join(" ")
        : String(legendaryResistanceTrait.text ?? ""))
    : "";

  if (!legendaryResistanceTrait && !otherTraits.length) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {legendaryResistanceTrait ? (
        <MonsterSectionPanel
          title="Legendary Resistance"
          actions={
            props.onChangeLegendaryResistancesUsed ? (
              <ResistanceDots
                total={resistanceCount}
                used={props.usedLegendaryResistances ?? 0}
                onChange={props.onChangeLegendaryResistancesUsed}
              />
            ) : null
          }
        >
          {resistanceText ? (
            <div style={{ color: theme.colors.text, opacity: 0.9, fontSize: "var(--fs-medium)", lineHeight: 1.35, padding: "10px 12px", borderRadius: 10, background: theme.colors.panelBg, border: `1px solid ${theme.colors.panelBorder}` }}>
              {resistanceText}
            </div>
          ) : null}
        </MonsterSectionPanel>
      ) : null}

      {otherTraits.length > 0 ? (
        <MonsterSectionPanel title="Traits">
          <div style={{ display: "grid", gap: 8, maxHeight: 260, overflow: "auto" }}>
            {[...otherTraits]
              .sort((a, b) => {
                const aIsSource = String(a?.name ?? "").trim().toLowerCase() === "source";
                const bIsSource = String(b?.name ?? "").trim().toLowerCase() === "source";
                if (aIsSource === bIsSource) return 0;
                return aIsSource ? 1 : -1;
              })
              .map((t, i) => {
                const name = String(t?.name ?? `Trait ${i + 1}`);
                const text = Array.isArray(t?.text) ? t.text.map(String).join(" ") : String(t?.text ?? "");
                return <ActionRow key={`${name}-${i}`} title={name} subtitle={text} />;
              })}
          </div>
        </MonsterSectionPanel>
      ) : null}
    </div>
  );
}
