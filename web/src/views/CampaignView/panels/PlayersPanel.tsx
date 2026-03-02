import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconPlayer, IconPlus, IconSkull, IconRest, IconPencil } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import type { Combatant, Player } from "@/domain/types/domain";

export function PlayersPanel(props: {
  players: Player[];
  combatants: Combatant[];
  selectedEncounterId: string | null;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;
  onFullRest: () => void;
}) {
  const players = React.useMemo(() => {
    return props.players.map((p) => {
      const acBonus = Number(p.overrides?.acBonus ?? 0) || 0;
      const hpMod = (() => {
        const v = p.overrides?.hpMaxOverride;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      })();
      return {
        ...p,
        playerId: p.id,
        ac: Math.max(0, p.ac + acBonus),
        acBonus: 0,
        hpMax: Math.max(1, p.hpMax + hpMod),
        tempHp: Math.max(0, Number(p.overrides?.tempHp ?? 0) || 0),
        conditions: p.conditions ?? [],
      };
    });
  }, [props.players]);

  const playerIdsInEncounter = React.useMemo(() => {
    if (!props.selectedEncounterId) return new Set<string>();
    return new Set(
      props.combatants
        .filter((c) => c.encounterId === props.selectedEncounterId && c.baseType === "player")
        .map((c) => c.baseId)
    );
  }, [props.combatants, props.selectedEncounterId]);

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconPlayer /> Players ({players.length})
        </span>
      }
      actions={
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <IconButton title="Full Rest" onClick={props.onFullRest}>
            <IconRest />
          </IconButton>
          <IconButton onClick={props.onCreatePlayer} title="Add player">
            <IconPlus />
          </IconButton>
        </div>
      }
    >
      {players.length ? (
        <div style={{ display: "grid", gap: 5, gridTemplateColumns: "1fr" }}>
          {players.map((p) => {
            const alreadyIn = props.selectedEncounterId ? playerIdsInEncounter.has(p.id) : false;
            return (
              <PlayerRow
                key={p.id}
                p={p}
                icon={p.hpCurrent > 0 ? <IconPlayer /> : <IconSkull />}
                subtitle={<>Lvl {p.level} {p.species} {p.class}</>}
                onEdit={() => props.onEditPlayer(p.id)}
                actions={
                  props.selectedEncounterId ? (
                    <>
                      <IconButton title="Edit" onClick={(e) => (e.stopPropagation(), props.onEditPlayer(p.id))}>
                        <IconPencil />
                      </IconButton>
                      <IconButton
                        title={alreadyIn ? "Already in encounter" : "Add to encounter"}
                        onClick={(e) => (e.stopPropagation(), alreadyIn ? null : props.onAddPlayerToEncounter(p.id))}
                        disabled={alreadyIn}
                      >
                        <IconPlus />
                      </IconButton>
                    </>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      ) : (
        <div style={{ color: theme.colors.muted }}>No players yet.</div>
      )}
    </Panel>
  );
}
