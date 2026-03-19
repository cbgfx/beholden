import React from "react";
import type { AttackOverride, Combatant } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconConditions } from "@/icons/index";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import type { MonsterDetail } from "@/domain/types/compendium";
import { MonsterActions } from "@/views/CombatView/components/MonsterActions";
import { MonsterSpells } from "@/views/CombatView/components/MonsterSpells";
import { MonsterTraits } from "@/views/CombatView/components/MonsterTraits";
import type { Player } from "@/domain/types/domain";

import { CombatantConditionsSection } from "@/views/CombatView/panels/CombatantDetailsPanel/components/CombatantConditionsSection";
import { useCharacterSheetStats } from "@/views/CombatView/panels/CombatantDetailsPanel/hooks/useCharacterSheetStats";
import { PlayerDeathSaves } from "@/views/CampaignView/components/PlayerDeathSaves";

export type CombatantDetailsCtx = {
  isNarrow: boolean;
  selectedMonster: MonsterDetail | null;
  playerName: string | null;
  player: Player | null;
  spellNames: string[];
  spellLevels: Record<string, number | null>;
  roster: Combatant[];
  activeForCaster: Combatant | null;
  currentRound: number;
  showHpActions: boolean;
  onChangeAttack: (actionName: string, patch: AttackOverride) => void;
  onUpdate: (patch: Record<string, unknown>) => void;
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

function buildCreatureTypeLine(monster: MonsterDetail | null): string | null {
  if (!monster) return null;
  const raw = (monster.raw_json ?? monster) as Record<string, unknown>;

  const sizeMap: Record<string, string> = {
    T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
  };
  const sizeRaw = String(raw.size ?? "").trim();
  const size = sizeMap[sizeRaw] ?? sizeRaw;

  const type = (() => {
    const t = raw.typeFull ?? raw.type ?? raw.typeKey;
    if (!t) return "";
    if (typeof t === "string") return t;
    if (typeof t === "object" && t !== null) {
      const o = t as Record<string, unknown>;
      const base = typeof o.type === "string" ? o.type : "";
      const tags = Array.isArray(o.tags) ? (o.tags as unknown[]).map(String).join(", ") : "";
      return tags ? `${base} (${tags})` : base;
    }
    return "";
  })();

  const align = (() => {
    const alignMap: Record<string, string> = {
      L: "lawful", N: "neutral", C: "chaotic", G: "good", E: "evil", U: "unaligned", A: "any",
    };
    const a = raw.alignment;
    if (!a) return "";
    if (typeof a === "string") return a;
    if (Array.isArray(a)) return a.map((x: unknown) => alignMap[String(x)] ?? String(x).toLowerCase()).join(" ");
    return "";
  })();

  const creature = [size, type].filter(Boolean).join(" ");
  return [creature, align].filter(Boolean).join(", ") || null;
}

export function CombatantDetailsPanel(props: Props) {
  const { roleTitle, role, combatant, ctx } = props;

  const selected = combatant ?? null;
  const isMonster = selected?.baseType === "monster" || (selected?.baseType === "inpc" && !!ctx.selectedMonster);
  const isPlayer = selected?.baseType === "player";
  const titleMain = selected ? (selected.label || selected.name || "(Unnamed)") : "No selection";
  const monsterBaseName = isMonster ? selected!.name.trim() : "";
  const showMonsterBaseName = isMonster && monsterBaseName &&
    monsterBaseName.toLowerCase() !== titleMain.toLowerCase();

  const creatureTypeLine = isMonster ? buildCreatureTypeLine(ctx.selectedMonster) : null;

  const sheetStats: CharacterSheetStats | null = useCharacterSheetStats({
    combatant: selected,
    selectedMonster: ctx.selectedMonster,
    player: ctx.player
  });

  return (
    <Panel
      style={{ padding: "12px 14px" }}
      title={
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
            <span style={{ fontSize: "var(--fs-title)", fontWeight: 900 }}>
              {roleTitle ? <span style={{ color: theme.colors.accentPrimary }}>{roleTitle}: </span> : null}
              {titleMain}
            </span>
            {selected ? (
              isMonster ? (
                showMonsterBaseName ? (
                  <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, flexShrink: 0 }}>({monsterBaseName})</span>
                ) : null
              ) : isPlayer ? (
                <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, flexShrink: 0 }}>
                  ({ctx.playerName || "Player"})
                </span>
              ) : null
            ) : null}
          </div>
          {creatureTypeLine ? (
            <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 600, letterSpacing: 0.2 }}>
              {creatureTypeLine}
            </span>
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
          </div>
        )
      }
    >
      {!selected ? (
        <div style={{ color: theme.colors.muted }}>Select a combatant.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sheetStats ? <CharacterSheetPanel stats={sheetStats} /> : null}

          {/* Death saves — only for player combatants at 0 HP */}
          {isPlayer && (selected.hpCurrent ?? 1) <= 0 ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: theme.colors.panelBg,
                border: `1px solid ${theme.colors.panelBorder}`,
              }}
            >
              <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, marginBottom: 10 }}>
                Death Saves
              </div>
              <PlayerDeathSaves
                encounterId={String(selected.encounterId)}
                combatantId={String(selected.id)}
                variant="combatList"
                persisted={selected.deathSaves ?? undefined}
                hpCurrent={selected.hpCurrent ?? 0}
              />
            </div>
          ) : null}

          <CombatantConditionsSection
            selected={selected}
            role={role}
            roster={ctx.roster ?? []}
            currentRound={ctx.currentRound}
            onCommit={(next) => ctx.onUpdate({ conditions: next })}
          />

          {ctx.selectedMonster ? (
            <MonsterActions
              monster={ctx.selectedMonster}
              attackOverrides={combatant?.attackOverrides as Record<string, AttackOverride> | null | undefined}
              onChangeAttack={ctx.onChangeAttack}
              usedLegendaryActions={combatant?.usedLegendaryActions ?? 0}
              onChangeLegendaryUsed={(n) => ctx.onUpdate({ usedLegendaryActions: n })}
            />
          ) : null}

          {ctx.selectedMonster ? (
            <MonsterSpells
              spellNames={ctx.spellNames}
              spellLevels={ctx.spellLevels}
              onOpenSpell={ctx.onOpenSpell}
              slots={(ctx.selectedMonster as any).slots}
              usedSpellSlots={combatant?.usedSpellSlots}
              onChangeSpellSlots={(level, used) =>
                ctx.onUpdate({
                  usedSpellSlots: { ...(combatant?.usedSpellSlots ?? {}), [String(level)]: used },
                })
              }
            />
          ) : null}

          {ctx.selectedMonster ? (
            <MonsterTraits
              monster={ctx.selectedMonster}
              usedLegendaryResistances={combatant?.usedLegendaryResistances ?? 0}
              onChangeLegendaryResistancesUsed={(n) => ctx.onUpdate({ usedLegendaryResistances: n })}
            />
          ) : null}
        </div>
      )}
    </Panel>
  );
}
