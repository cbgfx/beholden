import React from "react";
import { Input } from "@/ui/Input";
import { theme, withAlpha } from "@/theme/theme";
import type { MonsterDetail } from "@/views/CombatView/types";
import type { AttackOverride } from "@/domain/types/domain";
import { ActionRow } from "@/views/CombatView/components/ActionRow";
import { MonsterSectionPanel } from "@/components/MonsterDisplay/MonsterSectionPanel";

type MonsterActionEntry = {
  name?: string;
  title?: string;
  text?: string | string[] | null;
  attack?: unknown;
};

function isAttackAction(a: MonsterActionEntry): boolean {
  if (a?.attack) return true;
  const text = Array.isArray(a?.text) ? a.text.map(String).join(" ") : String(a?.text ?? "");
  return /\bto\s+hit\b/i.test(text);
}

function parseAttackDefaults(a: MonsterActionEntry): { toHit?: number; damage?: string } {
  if (a?.attack) {
    const parts = String(a.attack).split("||");
    if (parts.length >= 3) {
      const ht = parseInt(parts[1].trim(), 10);
      const dmg = parts[2].trim();
      return { toHit: Number.isFinite(ht) ? ht : undefined, damage: dmg || undefined };
    }
  }
  const text = Array.isArray(a?.text) ? a.text.map(String).join(" ") : String(a?.text ?? "");
  const hitMatch = text.match(/([+-]?\d+)\s+to\s+hit/i);
  const toHit = hitMatch ? parseInt(hitMatch[1], 10) : undefined;
  const dmgMatch = text.match(/\bHit:\s+\d+\s*\(([^)]+)\)/i);
  const damage = dmgMatch ? dmgMatch[1].replace(/\s+/g, "") : undefined;
  return { toHit: toHit !== undefined && Number.isFinite(toHit) ? toHit : undefined, damage };
}

function fmtToHit(n: number | undefined): string {
  if (n == null) return "+0";
  return n >= 0 ? `+${n}` : String(n);
}

function parseLegendaryCount(intro: string | null): number {
  if (!intro) return 3;
  const m = intro.match(/can take (\d+) legendary/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > 0) return n;
  }
  return 3;
}

function LegendaryDots({
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
            title={spent ? "Spent — click to restore one" : "Click to spend one legendary action"}
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
      {used > 0 ? (
        <button
          title="Restore all legendary actions"
          onClick={() => onChange(0)}
          style={{
            all: "unset",
            cursor: "pointer",
            marginLeft: 4,
            fontSize: "var(--fs-tiny)",
            color: theme.colors.muted,
            fontWeight: 700,
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          ↺
        </button>
      ) : null}
    </div>
  );
}

function ActionSection({
  title,
  items,
  editable,
  attackOverrides,
  onChangeAttack,
}: {
  title: string;
  items: MonsterActionEntry[];
  editable?: boolean;
  attackOverrides?: Record<string, AttackOverride> | null;
  onChangeAttack?: (actionName: string, patch: AttackOverride) => void;
}) {
  if (!items.length) return null;

  return (
    <MonsterSectionPanel title={title}>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((a, i: number) => {
          const name = String(a?.name ?? a?.title ?? "");

          if (editable && isAttackAction(a) && onChangeAttack) {
            const ov = attackOverrides?.[name];
            const defaults = parseAttackDefaults(a);
            const toHitVal = ov?.toHit != null ? String(ov.toHit) : "";
            const dmgVal = ov?.damage ?? "";
            const toHitPlaceholder = fmtToHit(defaults.toHit);
            const dmgPlaceholder = defaults.damage ?? "1d6+2";
            const text = Array.isArray(a?.text) ? a.text.map(String).join(" ") : String(a?.text ?? "");

            return (
              <div key={`${title}-${i}`} style={{ padding: "10px 12px", borderRadius: 10, background: theme.colors.panelBg, border: `1px solid ${theme.colors.panelBorder}` }}>
                <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", marginBottom: 6 }}>{name}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>To Hit</div>
                    <Input
                      value={toHitVal}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9+-]/g, "");
                        onChangeAttack(name, { toHit: v ? Number(v) : undefined });
                      }}
                      placeholder={toHitPlaceholder}
                      style={{ width: 60 }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>Damage</div>
                    <Input value={dmgVal} onChange={(e) => onChangeAttack(name, { damage: e.target.value })} placeholder={dmgPlaceholder} style={{ width: 92 }} />
                  </div>
                </div>
                {text ? <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", lineHeight: 1.35 }}>{text}</div> : null}
              </div>
            );
          }

          return <ActionRow key={`${title}-${i}`} row={a} />;
        })}
      </div>
    </MonsterSectionPanel>
  );
}

export function MonsterActions(props: {
  monster: MonsterDetail;
  attackOverrides?: Record<string, AttackOverride> | null;
  onChangeAttack?: (actionName: string, patch: AttackOverride) => void;
  usedLegendaryActions?: number;
  onChangeLegendaryUsed?: (n: number) => void;
}) {
  const actions = Array.isArray(props.monster.action) ? (props.monster.action as MonsterActionEntry[]) : [];
  const reactions = Array.isArray(props.monster.reaction) ? (props.monster.reaction as MonsterActionEntry[]) : [];
  const legendaryRaw = Array.isArray(props.monster.legendary) ? (props.monster.legendary as MonsterActionEntry[]) : [];

  const legendaryIntro = React.useMemo(() => {
    const intro = legendaryRaw.find((l) =>
      String(l?.name ?? "").toLowerCase().includes("legendary actions")
    );
    if (!intro) return null;
    const text = Array.isArray(intro?.text) ? intro.text.map(String).join(" ") : String(intro?.text ?? "");
    return text || null;
  }, [legendaryRaw]);

  const legendary = React.useMemo(
    () => legendaryRaw.filter((l) => !String(l?.name ?? "").toLowerCase().includes("legendary actions")),
    [legendaryRaw]
  );

  const legendaryCount = React.useMemo(() => parseLegendaryCount(legendaryIntro), [legendaryIntro]);
  const showLegendary = Boolean(legendaryIntro) || legendary.length > 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ActionSection
        title="Actions"
        items={actions}
        editable
        attackOverrides={props.attackOverrides}
        onChangeAttack={props.onChangeAttack}
      />
      <ActionSection title="Reactions" items={reactions} />

      {showLegendary ? (
        <MonsterSectionPanel
          title="Legendary Actions"
          actions={
            props.onChangeLegendaryUsed ? (
              <LegendaryDots total={legendaryCount} used={props.usedLegendaryActions ?? 0} onChange={props.onChangeLegendaryUsed} />
            ) : null
          }
        >
          {legendaryIntro ? (
            <div style={{ color: theme.colors.text, opacity: 0.9, fontSize: "var(--fs-medium)", lineHeight: 1.35, padding: "10px 12px", borderRadius: 10, background: theme.colors.panelBg, border: `1px solid ${theme.colors.panelBorder}` }}>
              {legendaryIntro}
            </div>
          ) : null}
          {legendary.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {legendary.map((l, i: number) => (
                <ActionRow key={`legendary-${i}`} row={l} />
              ))}
            </div>
          ) : null}
        </MonsterSectionPanel>
      ) : null}
    </div>
  );
}
