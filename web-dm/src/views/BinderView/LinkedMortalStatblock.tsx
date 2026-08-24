import React from "react";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { FlatCampaignCharacterDto } from "@beholden/shared/api";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import { api } from "@/services/api";
import { fetchCampaignCharacter } from "@/services/actorApi";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { MonsterStatblock } from "@/views/CampaignView/monsterPicker/statblock/MonsterStatblock";

type NpcMechanics = {
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: Record<string, { toHit?: number; damage?: string; damageType?: string }> | null;
};

export function LinkedMortalStatblock(props: {
  mortalId: string;
  monsterId: string | null;
  playerLink?: { campaignId: string; playerId: string } | null;
  mechanics: NpcMechanics | null;
  accent: string;
}) {
  const [monster, setMonster] = React.useState<MonsterDetail | null>(null);
  const [player, setPlayer] = React.useState<FlatCampaignCharacterDto | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setMonster(null);
    setPlayer(null);
    setError(null);
    const request = props.monsterId
      ? api<MonsterDetail>(`/api/compendium/monsters/${encodeURIComponent(props.monsterId)}`)
          .then((result) => { if (!cancelled) setMonster(result); })
      : props.playerLink
        ? fetchCampaignCharacter(props.playerLink.campaignId, props.playerLink.playerId)
            .then((result) => { if (!cancelled) setPlayer(result); })
        : null;
    if (!request) return () => { cancelled = true; };
    request
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load statblock."); });
    return () => { cancelled = true; };
  }, [props.monsterId, props.playerLink?.campaignId, props.playerLink?.playerId]);

  const displayedMonster = React.useMemo(() => {
    if (!monster) return null;
    const mechanics = props.mechanics;
    if (!mechanics) return monster;
    return {
      ...monster,
      hp: mechanics.hpMax === null
        ? monster.hp
        : { average: mechanics.hpMax, ...(mechanics.hpDetails ? { formula: mechanics.hpDetails } : {}) },
      ac: mechanics.ac === null
        ? monster.ac
        : { value: mechanics.ac, ...(mechanics.acDetails ? { details: mechanics.acDetails } : {}) },
    };
  }, [monster, props.mechanics]);

  const playerStats = React.useMemo((): CharacterSheetStats | null => {
    if (!player) return null;
    const acBonus = Number(player.overrides?.acBonus ?? 0) || 0;
    const hpBonusValue = Number(player.overrides?.hpMaxBonus ?? 0);
    const hpBonus = Number.isFinite(hpBonusValue) ? hpBonusValue : 0;
    const hpMax = Math.max(1, Number(player.hpMax ?? 1) + hpBonus);
    const speed = Math.max(0, Number(player.speed ?? 30));
    return {
      ac: Math.max(0, Number(player.ac ?? 10) + acBonus),
      hpCur: Math.max(0, Number(player.hpCurrent ?? 0)),
      hpMax,
      tempHp: Math.max(0, Number(player.overrides?.tempHp ?? 0) || 0),
      speed,
      speedDisplay: `${speed} ft.`,
      abilities: {
        str: Number(player.str ?? 10), dex: Number(player.dex ?? 10), con: Number(player.con ?? 10),
        int: Number(player.int ?? 10), wis: Number(player.wis ?? 10), cha: Number(player.cha ?? 10),
      },
      saves: undefined,
      infoLines: [],
    };
  }, [player]);

  const hasLink = Boolean(props.monsterId || props.playerLink);

  return <Panel
    title="Statblock"
    titleColor={props.accent}
    storageKey={`binder-mortal-statblock:${props.mortalId}`}
  >
    {!hasLink ? <div style={{ color: theme.colors.muted }}>No linked statblock</div> : null}
    {error ? <div style={{ color: theme.colors.red }}>Unable to load statblock: {error}</div> : null}
    {hasLink && !error && !displayedMonster && !playerStats ? <div style={{ color: theme.colors.muted }}>Loading statblock…</div> : null}
    {displayedMonster ? <MonsterStatblock
      monster={displayedMonster}
      attackOverrides={props.mechanics?.attackOverrides ?? undefined}
    /> : null}
    {playerStats ? <CharacterSheetPanel stats={playerStats} /> : null}
  </Panel>;
}
