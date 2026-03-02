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

export type CombatantDetailsCtx = {
  isNarrow: boolean;
  selectedMonster: MonsterDetail | null;
  playerName: string | null;
  player: Player | null;
  spellNames: string[];
  spellLevels: Record<string, number | null>;
  roster: Combatant[];
  activeForCaster: Combatant | null;
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

export function CombatantDetailsPanel(props: Props) {
  const { roleTitle, role, combatant, ctx } = props;

  const selected = combatant ?? null;
  const isMonster = selected?.baseType === "monster" || (selected?.baseType === "inpc" && !!ctx.selectedMonster);
  const isPlayer = selected?.baseType === "player";
  const titleMain = selected ? (selected.label || selected.name || "(Unnamed)") : "No selection";
  const monsterBaseName = isMonster ? selected!.name.trim() : "";
  const showMonsterBaseName = isMonster && monsterBaseName &&
    monsterBaseName.toLowerCase() !== titleMain.toLowerCase();

  const sheetStats: CharacterSheetStats | null = useCharacterSheetStats({
    combatant: selected,
    selectedMonster: ctx.selectedMonster,
    player: ctx.player
  });

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
            {roleTitle ? <span style={{ color: theme.colors.accentPrimary }}>{roleTitle}: </span> : null}
            {titleMain} &nbsp;
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

          <CombatantConditionsSection
            selected={selected}
            role={role}
            roster={ctx.roster ?? []}
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
            <MonsterSpells spellNames={ctx.spellNames} spellLevels={ctx.spellLevels} onOpenSpell={ctx.onOpenSpell} />
          ) : null}

          {ctx.selectedMonster ? <MonsterTraits monster={ctx.selectedMonster} /> : null}
        </div>
      )}
    </Panel>
  );
}
