import * as React from "react";
import { parseLeadingNumber } from "@/lib/parse/statDetails";
import { theme } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import { formatCr } from "@/views/CampaignView/monsterPicker/utils";
import { parseSpeedVal, parseSpeedDisplay, buildMonsterInfoLines } from "@/utils/compendiumFormat";
import { useMonsterSpells } from "./useMonsterSpells";
import { MonsterSpellPanel } from "./MonsterSpellPanel";

type AttackOverride = { toHit?: number; damage?: string; damageType?: string };

function readNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return parseLeadingNumber(v);
  if (Array.isArray(v)) return readNumber(v[0]);
  if (typeof v === "object") {
    const inner =
      (v as any).value ?? (v as any).average ?? (v as any).avg ??
      (v as any).ac ?? (v as any).armor_class ?? (v as any).hit_points;
    if (inner != null && inner !== v) return readNumber(inner);
    return parseLeadingNumber(String(v));
  }
  return null;
}

function isSpellSection(name: unknown): boolean {
  const s = String(name ?? "");
  return /spellcasting/i.test(s) || /innate spellcasting/i.test(s);
}

function TextBlock({ items, title }: { items: any[]; title: string }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ color: theme.colors.accentPrimary, fontWeight: 900 }}>{title}</div>
      {items.map((t: any, i: number) => (
        <div key={i} style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 900 }}>{t.name ?? t.title}</div>
          <div style={{ color: theme.colors.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
            {t.text ?? t.description ?? ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttackOverrideInputs({ name, override, onChange }: {
  name: string;
  override: AttackOverride | undefined;
  onChange: (name: string, patch: AttackOverride) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>To Hit</div>
        <Input
          value={override?.toHit != null ? String(override.toHit) : ""}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9-]/g, "");
            onChange(name, { toHit: v ? Number(v) : undefined });
          }}
          placeholder="+0"
          style={{ width: 60 }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>Damage</div>
        <Input value={override?.damage ?? ""} onChange={(e) => onChange(name, { damage: e.target.value })} placeholder="1d6+2" style={{ width: 92 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ color: theme.colors.muted, fontWeight: 900, fontSize: "var(--fs-small)" }}>Type</div>
        <Input value={override?.damageType ?? ""} onChange={(e) => onChange(name, { damageType: e.target.value })} placeholder="piercing" style={{ width: 92 }} />
      </div>
    </div>
  );
}

export function MonsterStatblock(props: {
  monster: any | null;
  hideSummary?: boolean;
  attackOverrides?: Record<string, AttackOverride>;
  onChangeAttack?: (actionName: string, patch: AttackOverride) => void;
}) {
  const m = props.monster;

  // ALL hooks must be called unconditionally before any early return
  const spells = useMonsterSpells(m);

  const sheetStats: CharacterSheetStats | null = React.useMemo(() => {
    if (!m) return null;
    const ac = m.ac?.value ?? m.ac ?? m.armor_class;
    const hp = m.hp?.average ?? m.hp ?? m.hit_points;
    const raw: Record<string, unknown> = (m.raw_json ?? m) as Record<string, unknown>;
    return {
      ac: readNumber(ac) ?? NaN,
      hpCur: readNumber(hp) ?? NaN,
      hpMax: readNumber(hp) ?? NaN,
      speed: parseSpeedVal(raw["speed"] ?? m.speed),
      speedDisplay: parseSpeedDisplay(raw["speed"] ?? m.speed),
      abilities: {
        str: readNumber(m.str) ?? 10,
        dex: readNumber(m.dex) ?? 10,
        con: readNumber(m.con) ?? 10,
        int: readNumber(m.int) ?? 10,
        wis: readNumber(m.wis) ?? 10,
        cha: readNumber(m.cha) ?? 10,
      },
      saves: undefined,
      infoLines: buildMonsterInfoLines(raw),
    };
  }, [m]);

  // Early return AFTER all hooks
  if (!m) {
    return <div style={{ color: theme.colors.muted }}>Select a monster to preview its stats.</div>;
  }

  const ac = m.ac?.value ?? m.ac ?? m.armor_class;
  const hp = m.hp?.average ?? m.hp ?? m.hit_points;
  const type = m.type?.type ?? m.type;
  const alignment = m.alignment;
  const cr = formatCr(m.cr ?? m.challenge_rating);

  const traitArr: any[] = Array.isArray(m.traits ?? m.trait) ? (m.traits ?? m.trait) : [];
  const actionArr: any[] = Array.isArray(m.actions ?? m.action) ? (m.actions ?? m.action) : [];
  const legendary: any[] = Array.isArray(m.legendary ?? m.legendaryActions) ? (m.legendary ?? m.legendaryActions) : [];

  const nonSpellTraits = traitArr.filter((t) => !isSpellSection(t?.name ?? t?.title));
  const nonSpellActions = actionArr.filter((a) => !isSpellSection(a?.name ?? a?.title));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {!props.hideSummary && (
        <div>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-title)", color: theme.colors.text }}>{m.name}</div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
            {[type, alignment, cr ? `CR ${cr}` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}

      {sheetStats && <CharacterSheetPanel stats={sheetStats} />}

      {spells.groupedSpells.length > 0 && <MonsterSpellPanel spells={spells} />}

      <TextBlock items={nonSpellTraits} title="Traits" />

      {nonSpellActions.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ color: theme.colors.accentPrimary, fontWeight: 900 }}>Actions</div>
          {nonSpellActions.map((a: any, i: number) => {
            const name = a.name ?? a.title ?? "";
            return (
              <div key={i} style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 900 }}>{name}</div>
                <div style={{ color: theme.colors.muted, whiteSpace: "pre-wrap", fontSize: "var(--fs-subtitle)" }}>
                  {a.text ?? a.description ?? ""}
                </div>
                {props.onChangeAttack && (
                  <AttackOverrideInputs name={name} override={props.attackOverrides?.[name]} onChange={props.onChangeAttack} />
                )}
              </div>
            );
          })}
        </div>
      )}

      <TextBlock items={legendary} title="Legendary Actions" />
    </div>
  );
}
