import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconPlayer, IconPlus, IconSkull, IconRest, IconTrash } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import type { EncounterActor, CampaignCharacter } from "@/domain/types/domain";

export function PlayersPanel(props: {
  players: CampaignCharacter[];
  combatants: EncounterActor[];
  selectedEncounterId: string | null;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;
  onFullRest: () => void;
}) {
  const players = React.useMemo(() => {
    return [...props.players].sort((a, b) => a.characterName.localeCompare(b.characterName)).map((p) => {
      const acBonus = Number(p.overrides?.acBonus ?? 0) || 0;
      const baseAc = p.syncedAc ?? p.ac;
      const hpMod = (() => {
        const n = Number(p.overrides?.hpMaxBonus ?? 0);
        return Number.isFinite(n) ? n : 0;
      })();
      return {
        ...p,
        playerId: p.id,
        ac: Math.max(0, baseAc + acBonus),
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
      storageKey="campaign-players"
      title={`Players (${players.length})`}
      actions={
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <IconButton title="Full Rest" onClick={props.onFullRest} variant="accent">
            <IconRest />
          </IconButton>
          <IconButton onClick={props.onCreatePlayer} title="Add player" variant="accent">
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
                onEdit={() => props.onEditPlayer(p.id)}
                actions={
                  <>
                    {props.selectedEncounterId ? (
                      <IconButton
                        title={alreadyIn ? "Already in encounter" : "Add to encounter"}
                        onClick={(e) => (e.stopPropagation(), alreadyIn ? null : props.onAddPlayerToEncounter(p.id))}
                        disabled={alreadyIn}
                        variant="ghost"
                        size="sm"
                      >
                        <IconPlus />
                      </IconButton>
                    ) : null}
                    <button
                      type="button"
                      title={p.userId ? "Remove from Campaign" : "Delete Character"}
                      onClick={(e) => { e.stopPropagation(); props.onDeletePlayer(p.id); }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        border: `1px solid ${theme.colors.red}66`,
                        background: "rgba(248,113,113,0.14)",
                        color: theme.colors.red,
                        cursor: "pointer",
                      }}
                    >
                      <IconTrash size={14} />
                    </button>
                  </>
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
