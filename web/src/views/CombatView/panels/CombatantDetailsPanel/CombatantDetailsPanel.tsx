import React from "react";
import type { Combatant } from "../../../../app/types/domain";
import { theme } from "../../../../app/theme/theme";
import { Panel } from "../../../../components/ui/Panel";
import { Button } from "../../../../components/ui/Button";
import { IconButton } from "../../../../components/ui/IconButton";
import { IconPencil, IconDroplet, IconConditions } from "../../../../components/icons/index";
import { conditionIconByKey } from "@/components/icons/conditions";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import type { MonsterDetail } from "@/app/types/compendium";
import { MonsterActions } from "../../components/MonsterActions";
import { MonsterSpells } from "../../components/MonsterSpells";
import { MonsterTraits } from "../../components/MonsterTraits";

function toFinite(n: any, fallback: number) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export type CombatantDetailsCtx = {
  isNarrow: boolean;
  selectedMonster: MonsterDetail | null;
  playerName: string | null;
  player: any | null;
  spellNames: string[];
  spellLevels: Record<string, number | null> | Record<string, number>;
  roster: Combatant[];
  activeForCaster: Combatant | null;
  showHpActions: boolean;

  delta?: string;
  onDeltaChange?: (v: string) => void;
  onDamage?: () => void;
  onHeal?: () => void;

  onUpdate: (patch: any) => void;
  onOpenOverrides: () => void;
  onOpenConditions: () => void;
  onOpenSpell: (name: string) => void;
};

type Props = {
  roleTitle: string;
  role: "active" | "target";
  combatant: Combatant | null;
  ctx: CombatantDetailsCtx;
};

export function CombatantDetailsPanel(props: Props) {
  const { roleTitle, role, combatant, ctx } = props;

  const selected = combatant ?? null;
  const selectedAny: any = selected as any;
  const isMonster = selectedAny?.baseType === "monster";
  const isPlayer = selectedAny?.baseType === "player";

  const norm = (v: any) => String(v ?? "").trim().toLowerCase();
  const titleMain = selected ? (selectedAny.label || selectedAny.name || "(Unnamed)") : "No selection";
  const monsterBaseName = isMonster ? String(selectedAny.name || "").trim() : "";
  const showMonsterBaseName = isMonster && monsterBaseName && norm(monsterBaseName) !== norm(titleMain);

  const CONDITIONS = React.useMemo(
    () =>
      [
        { key: "blinded", name: "Blinded" },
        { key: "charmed", name: "Charmed" },
        { key: "deafened", name: "Deafened" },
        { key: "frightened", name: "Frightened" },
        { key: "grappled", name: "Grappled" },
        { key: "incapacitated", name: "Incapacitated" },
        { key: "invisible", name: "Invisible" },
        { key: "paralyzed", name: "Paralyzed" },
        { key: "petrified", name: "Petrified" },
        { key: "poisoned", name: "Poisoned" },
        { key: "prone", name: "Prone" },
        { key: "restrained", name: "Restrained" },
        { key: "stunned", name: "Stunned" },
        { key: "unconscious", name: "Unconscious" },
        { key: "concentration", name: "Concentration" },
        { key: "hexed", name: "Hexed", needsCaster: true },
        { key: "marked", name: "Marked", needsCaster: true }
      ] as const,
    []
  );

  function conditionLabel(key: string) {
    return CONDITIONS.find((c) => c.key === key)?.name ?? key;
  }

  const allowedConditionKeys = React.useMemo(() => {
    // Active panel: only Concentration + Invisible
    // Target panel: everything except Concentration
    if (role === "active") return new Set(["concentration", "invisible"]);
    if (role === "target") {
      const s = new Set(CONDITIONS.map((c) => c.key));
      s.delete("concentration");
      return s;
    }
    return new Set(CONDITIONS.map((c) => c.key));
  }, [role, CONDITIONS]);

  const rosterById = React.useMemo(() => {
    const m: Record<string, Combatant> = {};
    for (const c of ctx.roster ?? []) m[(c as any).id] = c;
    return m;
  }, [ctx.roster]);

  const selectedConditions = React.useMemo(() => {
    const raw = (selectedAny?.conditions ?? []) as Array<any>;
    if (!Array.isArray(raw)) return [] as Array<{ key: string; casterId?: string | null }>;
    // (kept identical behavior: we don't filter by allowedConditionKeys here—UI controls do that upstream)
    return raw.map((c) => ({ key: String(c.key), casterId: c?.casterId != null ? String(c.casterId) : null }));
  }, [selectedAny?.id, selectedAny?.conditions, allowedConditionKeys]);

  function commitConditions(next: Array<{ key: string; casterId?: string | null }>) {
    if (!selectedAny) return;
    ctx.onUpdate({ conditions: next });
  }

  function removeConditionAt(index: number) {
    const next = [...selectedConditions];
    next.splice(index, 1);
    commitConditions(next);
  }

  const displayName = React.useCallback((c: Combatant | null) => {
    if (!c) return "—";
    const anyC: any = c as any;
    // Players: prefer character name; monsters: label; fallback: name.
    if (anyC.baseType === "player") return String(anyC.name || anyC.label || "Player");
    return String(anyC.label || anyC.name || "Creature");
  }, []);

  const pillStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: theme.colors.panelBg,
    fontSize: "var(--fs-pill)",
    fontWeight: 900,
    color: theme.colors.text,
    display: "inline-flex",
    alignItems: "center",
    gap: 8
  };

  const sheetStats: CharacterSheetStats | null = React.useMemo(() => {
    if (!selected) return null;
    const c: any = selected;
    const overrides = (c.overrides ?? null) as any;

    const acBonus = Number(overrides?.acBonus ?? 0) || 0;

    const hpMaxOverride = (() => {
      const v = overrides?.hpMaxOverride;
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    })();

    const hpMaxRaw = hpMaxOverride != null ? hpMaxOverride : Number(c.hpMax ?? 1);

    const hpMax = toFinite(hpMaxRaw, 0);
    const hpCur = toFinite(c.hpCurrent ?? 0, 0);
    const tempHp = Math.max(0, Number(overrides?.tempHp ?? 0) || 0);
    const ac = Math.max(0, toFinite(c.ac ?? 10, 10) + acBonus);

    const detail: any = ctx.selectedMonster?.raw_json ?? {};

    const speedVal = (() => {
      if (c.baseType !== "monster") {
        const p = ctx.player ?? null;
        const n = Number((p as any)?.speed);
        return Number.isFinite(n) && n > 0 ? n : 30;
      }

      const sp = detail.speed ?? ctx.selectedMonster?.speed;
      if (typeof sp === "number") return sp;
      if (typeof sp === "string") {
        const m = sp.match(/\d+/);
        return m ? Number(m[0]) : null;
      }
      if (sp && typeof sp === "object") {
        const w = (sp.walk ?? sp.value ?? sp.speed) as any;
        if (typeof w === "number") return w;
        if (typeof w === "string") {
          const m = w.match(/\d+/);
          return m ? Number(m[0]) : null;
        }
      }
      return null;
    })();

    const abilities = (() => {
      if (c.baseType === "monster") {
        const m = ctx.selectedMonster;
        return {
          str: Number(m?.str ?? detail.str ?? 10),
          dex: Number(m?.dex ?? detail.dex ?? 10),
          con: Number(m?.con ?? detail.con ?? 10),
          int: Number(m?.int ?? detail.int ?? 10),
          wis: Number(m?.wis ?? detail.wis ?? 10),
          cha: Number(m?.cha ?? detail.cha ?? 10)
        } as const;
      }
      const p = ctx.player ?? null;
      return {
        str: Number((p as any)?.str ?? 10),
        dex: Number((p as any)?.dex ?? 10),
        con: Number((p as any)?.con ?? 10),
        int: Number((p as any)?.int ?? 10),
        wis: Number((p as any)?.wis ?? 10),
        cha: Number((p as any)?.cha ?? 10)
      } as const;
    })();

    const saves = (() => {
      if (c.baseType !== "monster") return undefined;
      const raw = (detail.save ?? detail.saves ?? null) as any;
      if (!raw || typeof raw !== "object") return undefined;
      const out: any = {};
      for (const k of ["str", "dex", "con", "int", "wis", "cha"] as const) {
        const v = raw[k] ?? raw[k.toUpperCase()] ?? raw[k.charAt(0).toUpperCase() + k.slice(1)];
        if (v == null) continue;
        const n = Number(String(v).replace(/[^0-9-]/g, ""));
        if (Number.isFinite(n)) out[k] = n;
      }
      return out;
    })();

    const infoLines = (() => {
      if (c.baseType !== "monster") return [];

      const listToString = (v: any): string => {
        if (!v) return "";
        if (typeof v === "string") return v;
        if (Array.isArray(v)) {
          const parts = v
            .map((x) => {
              if (x == null) return "";
              if (typeof x === "string") return x;
              if (typeof x === "number") return String(x);
              if (typeof x === "object") {
                if (typeof (x as any).name === "string") return (x as any).name;
                if (typeof (x as any).note === "string" && typeof (x as any).type === "string")
                  return `${(x as any).type} ${(x as any).note}`;
                if (typeof (x as any).type === "string") return (x as any).type;
              }
              return String(x);
            })
            .map((s) => s.trim())
            .filter(Boolean);
          return parts.join(", ");
        }
        if (typeof v === "object") {
          try {
            return Object.entries(v)
              .map(([k, val]) => `${k} ${String(val).trim()}`)
              .join(", ");
          } catch {
            return "";
          }
        }
        return "";
      };

      const skillsStr = (() => {
        const skillsObj = (detail.skill ?? detail.skills ?? null) as any;
        if (typeof detail.skills === "string") return detail.skills;
        if (skillsObj && typeof skillsObj === "object") return listToString(skillsObj);
        return "";
      })();

      const sensesStr = listToString(detail.senses);
      const langsStr = listToString(detail.languages);

      const crStr = (() => {
        const cr = detail.cr ?? ctx.selectedMonster?.cr;
        const xp = detail.xp ?? detail.xp?.value;
        return cr != null ? `${cr}${xp != null ? ` (${xp} XP)` : ""}` : "";
      })();

      const dmgRes = listToString(detail.damageResist ?? detail.resist ?? detail.resistance);
      const dmgImm = listToString(detail.damageImmune ?? detail.immune ?? detail.immunity);
      const dmgVuln = listToString(detail.damageVulnerable ?? detail.vulnerable ?? detail.vulnerability);
      const condImm = listToString(detail.conditionImmune ?? detail.conditionImmunity ?? detail.condImmune);

      return [
        { label: "Skills", value: skillsStr || "—" },
        { label: "Senses", value: sensesStr || "—" },
        { label: "Languages", value: langsStr || "—" },
        { label: "Challenge Rating", value: crStr || "—" },
        { label: "Damage Resistances", value: dmgRes || "—" },
        { label: "Damage Vulnerabilities", value: dmgVuln || "—" },
        { label: "Damage Immunities", value: dmgImm || "—" },
        { label: "Condition Immunities", value: condImm || "—" }
      ];
    })();

    return {
      ac,
      hpCur,
      hpMax,
      tempHp,
      speed: speedVal,
      abilities,
      saves,
      infoLines
    };
  }, [
    selectedAny?.id,
    selectedAny?.hpCurrent,
    selectedAny?.hpMax,
    selectedAny?.ac,
    selectedAny?.overrides,
    ctx.selectedMonster?.id,
    ctx.player
  ]);

  return (
    <Panel
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: "var(--fs-title)",
            justifyContent: "space-between",
            width: "100%"
          }}
        >
          <span>
            {roleTitle ? <span style={{ color: theme.colors.accent }}>{roleTitle}: </span> : null}
            {titleMain}
          </span>

          {selected ? (
            isMonster ? (
              showMonsterBaseName ? (
                <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900 }}>({monsterBaseName})</span>
              ) : null
            ) : isPlayer ? (
              <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900 }}>
                ({ctx.playerName || "Player"})
              </span>
            ) : null
          ) : null}
        </div>
      }
      actions={
        !selected ? null : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <IconButton title="Conditions" onClick={ctx.onOpenConditions}>
              <IconConditions size={18} title="Conditions" />
            </IconButton>

            <IconButton title="Overrides" onClick={ctx.onOpenOverrides}>
              <IconPencil size={18} title="Overrides" />
            </IconButton>

            {ctx.showHpActions === false ? null : (
              <>
                <input
                  value={ctx.delta ?? ""}
                  onChange={(e) => ctx.onDeltaChange?.(e.target.value)}
                  placeholder=""
                  style={{
                    width: 54,
                    padding: "6px 8px",
                    borderRadius: 10,
                    border: `1px solid ${theme.colors.panelBorder}`,
                    background: theme.colors.panelBg,
                    color: theme.colors.text,
                    fontWeight: 900,
                    fontSize: "var(--fs-medium)"
                  }}
                />
                <Button variant="danger" onClick={ctx.onDamage}>
                  Damage
                </Button>
                <Button variant="health" onClick={ctx.onHeal}>
                  Heal
                </Button>
              </>
            )}
          </div>
        )
      }
    >
      {!selected ? (
        <div style={{ color: theme.colors.muted }}>Select a combatant.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: theme.colors.panelBg,
              border: `1px solid ${theme.colors.panelBorder}`
            }}
          >
            <div style={{ marginTop: 10 }}>{sheetStats ? <CharacterSheetPanel stats={sheetStats} /> : null}</div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: theme.colors.panelBg,
              border: `1px solid ${theme.colors.panelBorder}`
            }}
          >
            <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900 }}>Conditions</div>

            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selectedConditions.length ? (
                selectedConditions.map((c, idx) => {
                  const def = CONDITIONS.find((d) => d.key === c.key);
                  const needsCaster = Boolean((def as any)?.needsCaster);
                  const caster = c.casterId ? rosterById[c.casterId] : null;
                  const casterLabel = caster ? displayName(caster) : "";

                  return (
                    <span key={`${c.key}:${c.casterId ?? ""}:${idx}`} style={pillStyle}>
                      {(() => {
                          const CondIcon = conditionIconByKey[c.key];
                          return CondIcon ? (
                            <CondIcon size={14} title={conditionLabel(c.key)} style={{ opacity: 0.9 }} />
                          ) : null;
                        })()}
                        {conditionLabel(c.key)}
                      {needsCaster && casterLabel ? (
                        <span style={{ color: theme.colors.muted, fontWeight: 900 }}>({casterLabel})</span>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeConditionAt(idx);
                        }}
                        title="Remove"
                        style={{
                          border: `1px solid ${theme.colors.panelBorder}`,
                          background: "transparent",
                          color: theme.colors.text,
                          fontWeight: 900,
                          borderRadius: 999,
                          width: 20,
                          height: 20,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })
              ) : (
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>No conditions.</div>
              )}
            </div>
          </div>

          {ctx.selectedMonster ? <MonsterActions monster={ctx.selectedMonster} /> : null}

          {ctx.selectedMonster ? (
            <MonsterSpells spellNames={ctx.spellNames} spellLevels={ctx.spellLevels as any} onOpenSpell={ctx.onOpenSpell} />
          ) : null}

          {ctx.selectedMonster ? <MonsterTraits monster={ctx.selectedMonster} /> : null}
        </div>
      )}
    </Panel>
  );
}
