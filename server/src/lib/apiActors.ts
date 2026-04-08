import type {
  ActorConditionInstanceDto,
  ActorDeathSavesDto,
  ActorOverridesDto,
  CampaignCharacterDto,
  CharacterCampaignAssignmentDto,
  CharacterSheetDto,
  EncounterActorDto,
} from "@beholden/shared/api";
import type {
  StoredCampaignCharacter,
  StoredCharacterSheet,
  StoredEncounterActor,
  StoredOverrides,
} from "../server/userData.js";

interface CharacterSheetDtoInput {
  id: string;
  userId: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: Record<string, unknown> | null;
  sharedNotes: string;
  campaigns?: CharacterCampaignAssignmentDto[];
  campaignSharedNotes?: string;
  conditions?: Array<Record<string, unknown>>;
  overrides?: StoredOverrides;
  deathSaves?: ActorDeathSavesDto | { success: number; fail: number };
  createdAt?: number;
  updatedAt?: number;
}

function toOverridesDto(value: StoredCampaignCharacter["overrides"] | StoredEncounterActor["overrides"] | undefined): ActorOverridesDto | undefined {
  if (!value) return undefined;
  return {
    tempHp: value.tempHp,
    acBonus: value.acBonus,
    hpMaxBonus: value.hpMaxBonus,
    ...(value.inspiration !== undefined ? { inspiration: value.inspiration } : {}),
  };
}

function toDeathSavesDto(
  value: StoredCharacterSheet["deathSaves"] | StoredCampaignCharacter["deathSaves"] | StoredEncounterActor["deathSaves"] | undefined | null,
): ActorDeathSavesDto | undefined {
  if (!value) return undefined;
  return {
    success: value.success,
    fail: value.fail,
  };
}

function toConditionsDto(
  value: StoredCampaignCharacter["conditions"] | StoredEncounterActor["conditions"] | Array<Record<string, unknown>> | undefined,
): ActorConditionInstanceDto[] {
  return Array.isArray(value) ? (value as ActorConditionInstanceDto[]) : [];
}

export function toCharacterCampaignAssignmentDto(
  assignments: Array<{ id: string; campaignId: string; campaignName: string; playerId: string | null }>,
): CharacterCampaignAssignmentDto[] {
  return assignments.map((assignment) => ({
    id: assignment.id,
    campaignId: assignment.campaignId,
    campaignName: assignment.campaignName,
    playerId: assignment.playerId,
  }));
}

export function toCharacterSheetDto(
  character: CharacterSheetDtoInput,
): CharacterSheetDto {
  const live: CharacterSheetDto["live"] = {
    hpCurrent: character.hpCurrent,
    conditions: toConditionsDto(character.conditions),
  };
  const overrides = toOverridesDto(character.overrides);
  if (overrides) live.overrides = overrides;
  const deathSaves = toDeathSavesDto(character.deathSaves);
  if (deathSaves) live.deathSaves = deathSaves;
  const dto: CharacterSheetDto = {
    id: character.id,
    userId: character.userId,
    imageUrl: character.imageUrl ?? null,
    sharedNotes: character.sharedNotes ?? "",
    characterData: character.characterData ?? null,
    campaigns: character.campaigns ?? [],
    ...(character.campaignSharedNotes !== undefined ? { campaignSharedNotes: character.campaignSharedNotes } : {}),
    sheet: {
      name: character.name,
      playerName: character.playerName,
      className: character.className,
      species: character.species,
      level: character.level,
      hpMax: character.hpMax,
      hpCurrent: character.hpCurrent,
      ac: character.ac,
      speed: character.speed,
      strScore: character.strScore,
      dexScore: character.dexScore,
      conScore: character.conScore,
      intScore: character.intScore,
      wisScore: character.wisScore,
      chaScore: character.chaScore,
      color: character.color,
    },
    live,
  };
  if (character.createdAt !== undefined) dto.createdAt = character.createdAt;
  if (character.updatedAt !== undefined) dto.updatedAt = character.updatedAt;
  return dto;
}

export function toCampaignCharacterDto(character: StoredCampaignCharacter): CampaignCharacterDto {
  const live: CampaignCharacterDto["live"] = {
    hpCurrent: character.hpCurrent,
    conditions: toConditionsDto(character.conditions),
  };
  const overrides = toOverridesDto(character.overrides);
  if (overrides) live.overrides = overrides;
  const deathSaves = toDeathSavesDto(character.deathSaves);
  if (deathSaves) live.deathSaves = deathSaves;
  return {
    id: character.id,
    campaignId: character.campaignId,
    ...(character.userId !== undefined ? { userId: character.userId } : {}),
    ...(character.characterId !== undefined ? { characterId: character.characterId } : {}),
    ...(character.imageUrl !== undefined ? { imageUrl: character.imageUrl } : {}),
    ...(character.sharedNotes !== undefined ? { sharedNotes: character.sharedNotes } : {}),
    sheet: {
      playerName: character.playerName,
      characterName: character.characterName,
      class: character.class,
      species: character.species,
      level: character.level,
      hpMax: character.hpMax,
      ac: character.ac,
      ...(character.syncedAc !== undefined ? { syncedAc: character.syncedAc } : {}),
      ...(character.speed !== undefined ? { speed: character.speed } : {}),
      ...(character.str !== undefined ? { str: character.str } : {}),
      ...(character.dex !== undefined ? { dex: character.dex } : {}),
      ...(character.con !== undefined ? { con: character.con } : {}),
      ...(character.int !== undefined ? { int: character.int } : {}),
      ...(character.wis !== undefined ? { wis: character.wis } : {}),
      ...(character.cha !== undefined ? { cha: character.cha } : {}),
      ...(character.color !== undefined ? { color: character.color } : {}),
    },
    live,
    createdAt: character.createdAt,
    updatedAt: character.updatedAt,
  };
}

export function toEncounterActorDto(
  actor: StoredEncounterActor & { playerName?: string },
): EncounterActorDto {
  const live: EncounterActorDto["live"] = {
    initiative: actor.initiative,
    hpCurrent: actor.hpCurrent,
    conditions: toConditionsDto(actor.conditions),
  };
  const overrides = toOverridesDto(actor.overrides);
  if (overrides) live.overrides = overrides;
  if (actor.deathSaves !== undefined) live.deathSaves = actor.deathSaves ? toDeathSavesDto(actor.deathSaves)! : null;
  if (actor.usedReaction !== undefined) live.usedReaction = actor.usedReaction;
  if (actor.usedLegendaryActions !== undefined) live.usedLegendaryActions = actor.usedLegendaryActions;
  if (actor.usedLegendaryResistances !== undefined) live.usedLegendaryResistances = actor.usedLegendaryResistances;
  if (actor.usedSpellSlots !== undefined) live.usedSpellSlots = actor.usedSpellSlots;
  return {
    id: actor.id,
    encounterId: actor.encounterId,
    baseType: actor.baseType,
    baseId: actor.baseId,
    snapshot: {
      name: actor.name,
      label: actor.label,
      ...(actor.playerName ? { playerName: actor.playerName } : {}),
      friendly: actor.friendly,
      color: actor.color,
      hpMax: actor.hpMax,
      hpDetails: actor.hpDetails,
      ac: actor.ac,
      acDetails: actor.acDetails,
      attackOverrides: actor.attackOverrides,
    },
    live,
    createdAt: actor.createdAt,
    updatedAt: actor.updatedAt,
  };
}
