import { api, jsonInit } from "@/services/api";
import { useStore } from "@/store";
import { flattenCampaignCharacterDto, type CampaignCharacterDto } from "@beholden/shared/api";
import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconPlayer, IconPlus, IconSkull, IconRest, IconTrash, IconNotes } from "@/icons";
import { PlayerBackground } from "@/views/CampaignView/components/PlayerBackground";
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
  const translateUi = useUiTranslation("dmUi");
  const { dispatch } = useStore();
  const [showDead, setShowDead] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [lifeError, setLifeError] = React.useState<string | null>(null);
  const pendingRef = React.useRef(false);
  const campaignRef = React.useRef(props.players[0]?.campaignId);
  campaignRef.current = props.players[0]?.campaignId;
  async function changeLife(playerId: string, action: "markDead" | "revive") {
    if (pendingRef.current) return;
    pendingRef.current = true; setPending(playerId); setLifeError(null);
    try {
      const dto = await api<CampaignCharacterDto>(`/api/players/${playerId}/life-status`, jsonInit("POST", { action }));
      if (campaignRef.current === dto.campaignId) dispatch({ type: "upsertPlayer", player: flattenCampaignCharacterDto(dto) as CampaignCharacter });
    } catch (cause) { setLifeError(cause instanceof Error ? cause.message : translateUi("Unable to update life status.")); }
    finally { pendingRef.current = false; setPending(null); }
  }
  const [expandedBackgrounds, setExpandedBackgrounds] = React.useState<string[]>([]);
  const players = React.useMemo(() => {
    return [...props.players].sort((a, b) => a.characterName.localeCompare(b.characterName)).map((p) => {
      const acBonus = Number(p.overrides?.acBonus ?? 0) || 0;
      const baseAc = p.ac;
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

  const deadCount = players.filter(player => player.isDead).length;
  const activePlayers = players.filter(player => !player.isDead);
  const visiblePlayers = showDead ? [...activePlayers, ...players.filter(player => player.isDead)] : activePlayers;
  return (
    <Panel
      storageKey="campaign-players"
      title={<>{translateUi("Players ({{value1}})", { value1: activePlayers.length })}{deadCount ? <> <button type="button" aria-label={translateUi("Dead Players")} aria-expanded={showDead} onClick={(event) => { event.stopPropagation(); setShowDead(value => !value); }} style={{ border: 0, background: "none", color: theme.colors.muted, cursor: "pointer", font: "inherit" }}>({deadCount})</button></> : null}</>}
      actions={
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <IconButton title={translateUi("Full Rest")} onClick={props.onFullRest} variant="accent">
            <IconRest />
          </IconButton>
          <IconButton onClick={props.onCreatePlayer} title={translateUi("Add player")} variant="accent">
            <IconPlus />
          </IconButton>
        </div>
      }
    >
      {lifeError ? <div role="alert" style={{ color: theme.colors.red }}>{lifeError}</div> : null}
      {visiblePlayers.length ? (
        <div style={{ display: "grid", gap: 5, minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" }}>
          {visiblePlayers.map((p, index) => {
            const alreadyIn = props.selectedEncounterId ? playerIdsInEncounter.has(p.id) : false;
            return (
              <div key={p.id} style={{ display: "grid", gap: 5 }}>
                {p.isDead && (index === 0 || !visiblePlayers[index - 1]?.isDead) ? <h3 style={{ color: theme.colors.muted }}>{translateUi("Dead Players")}</h3> : null}
                <PlayerRow
                  p={p}
                  icon={p.hpCurrent > 0 ? <IconPlayer /> : <IconSkull />}
                  onEdit={() => props.onEditPlayer(p.id)}
                  deathSaveAction={!p.isDead && (p.deathSaves?.fail ?? 0) >= 3 ? (
                    <Button variant="danger" type="button" disabled={pending !== null} onClick={(event) => { event.stopPropagation(); void changeLife(p.id, "markDead"); }} style={{ padding: "4px 10px", whiteSpace: "nowrap" }}>{translateUi("Mark as Dead")}</Button>
                  ) : null}
                  primaryAction={p.isDead ? <Button variant="health" type="button" disabled={pending !== null} onClick={(event) => { event.stopPropagation(); void changeLife(p.id, "revive"); }} style={{ padding: "4px 10px" }}>{translateUi("Revive")}</Button> : (p.deathSaves?.fail ?? 0) >= 3 ? null : props.selectedEncounterId ? (
                    <IconButton
                      title={alreadyIn ? translateUi("Already in encounter") : translateUi("Add to encounter")}
                      onClick={(e) => (e.stopPropagation(), alreadyIn || p.isDead || (p.deathSaves?.fail ?? 0) >= 3 ? null : props.onAddPlayerToEncounter(p.id))}
                      disabled={alreadyIn}
                      variant="ghost"
                      size="sm"
                    >
                      <IconPlus />
                    </IconButton>
                  ) : null}
                  menuItems={[{
                    label: translateUi("Background"),
                    icon: <IconNotes size={14} />,
                    onClick: () => setExpandedBackgrounds((ids) => ids.includes(p.id) ? ids.filter((id) => id !== p.id) : [...ids, p.id]),
                  }, ...(!props.selectedEncounterId ? [{
                    label: p.userId ? "Remove from Campaign" : "Delete Character",
                    icon: <IconTrash size={14} />,
                    danger: true,
                    onClick: () => props.onDeletePlayer(p.id),
                  }] : [])]}
                />
                {expandedBackgrounds.includes(p.id) ? <div id={`player-background-${p.id}`}><PlayerBackground campaignId={p.campaignId} playerId={p.id} /></div> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ color: theme.colors.muted }}>{translateUi("No players yet.")}</div>
      )}
    </Panel>
  );
}
