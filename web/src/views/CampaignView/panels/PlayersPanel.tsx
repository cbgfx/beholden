import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconPlayer, IconPlus, IconSkull, IconRest, IconPencil } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";

export function PlayersPanel(props: {
  players: any[];
  combatants: any[];
  selectedEncounterId: string | null;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;
  onFullRest: () => void;
}) {
  // Players are campaign-persistent. Player combatants in encounters are merged from the
  // player record server-side, so the CampaignView should display the same effective stats.
  const players = React.useMemo(() => {
    return (props.players ?? []).map((p: any) => {
      const ov = p?.overrides ?? null;
      const hpMaxOverrideRaw = ov?.hpMaxOverride;
      const hpMaxOverride = hpMaxOverrideRaw == null ? null : Number(hpMaxOverrideRaw);
      const effectiveHpMax = Number.isFinite(hpMaxOverride) && hpMaxOverride > 0 ? hpMaxOverride : Number(p.hpMax ?? 0);
      return {
        ...p,
        hpMax: effectiveHpMax,
        tempHp: Math.max(0, Number(ov?.tempHp ?? 0) || 0),
        acBonus: Number(ov?.acBonus ?? 0) || 0,
      };
    });
  }, [props.players]);


  const playerIdsInEncounter = React.useMemo(() => {
    if (!props.selectedEncounterId) return new Set<string>();
    return new Set(
      (props.combatants ?? [])
        .filter((c) => c.encounterId === props.selectedEncounterId && c.baseType === "player")
        .map((c) => c.baseId)
    );
  }, [props.combatants, props.selectedEncounterId]);

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconPlayer /> Players ({players.length}) <span style={{ color: theme.colors.muted, fontWeight: 600 }}></span>
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
        <div
          style={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: "1fr",
          }}
        >
          {players.map((p) => {
            const alreadyIn = props.selectedEncounterId ? playerIdsInEncounter.has(p.id) : false;

            return (
              <PlayerRow
                key={p.id}
                p={p}
                icon={p.hpCurrent > 0 ? <IconPlayer /> : <IconSkull />}
                subtitle={
                  <>
                    Lvl {p.level} {p.species} {p.class}
                  </>
                }
                onEdit={() => props.onEditPlayer(p.id)}
                actions={
                  props.selectedEncounterId ? (
                    <>
                      <IconButton title="Edit" onClick={(e) => (e.stopPropagation(), props.onEditPlayer(p.id))}>
                        <IconPencil />
                      </IconButton>
                      <IconButton
                        title={alreadyIn ? "Already in encounter" : "Add to Encounter"}
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
