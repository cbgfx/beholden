export type ActorId = string;

export interface ActorConditionInstanceDto {
  key: string;
  casterId?: string | null;
  [k: string]: unknown;
}

export interface ActorDeathSavesDto {
  success: number;
  fail: number;
}

export interface ActorOverridesDto {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
}

export interface CharacterCampaignAssignmentDto {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface CharacterSheetSnapshotDto {
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
}

export interface CharacterSheetLiveDto {
  hpCurrent: number;
  conditions: ActorConditionInstanceDto[];
  overrides?: ActorOverridesDto;
  deathSaves?: ActorDeathSavesDto;
}

export interface CharacterSheetDto {
  id: ActorId;
  userId: ActorId;
  imageUrl: string | null;
  sharedNotes: string;
  characterData: Record<string, unknown> | null;
  campaigns: CharacterCampaignAssignmentDto[];
  campaignSharedNotes?: string;
  sheet: CharacterSheetSnapshotDto;
  live: CharacterSheetLiveDto;
  createdAt?: number;
  updatedAt?: number;
}

export interface CampaignCharacterSheetDto {
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  hpMax: number;
  ac: number;
  syncedAc?: number;
  speed?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  color?: string | null;
}

export interface CampaignCharacterLiveDto {
  hpCurrent: number;
  conditions: ActorConditionInstanceDto[];
  overrides?: ActorOverridesDto;
  deathSaves?: ActorDeathSavesDto;
}

export interface CampaignCharacterDto {
  id: ActorId;
  campaignId: ActorId;
  userId?: string | null;
  characterId?: string | null;
  imageUrl?: string | null;
  sharedNotes?: string;
  sheet: CampaignCharacterSheetDto;
  live: CampaignCharacterLiveDto;
  createdAt?: number;
  updatedAt?: number;
}

export type EncounterActorBaseTypeDto = "player" | "monster" | "inpc";

export interface EncounterActorSnapshotDto {
  name: string;
  label: string;
  playerName?: string;
  friendly: boolean;
  color: string;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
}

export interface EncounterActorLiveDto {
  initiative: number | null;
  hpCurrent: number | null;
  conditions: ActorConditionInstanceDto[];
  overrides?: ActorOverridesDto;
  deathSaves?: ActorDeathSavesDto | null;
  usedReaction?: boolean;
  usedLegendaryActions?: number;
  usedLegendaryResistances?: number;
  usedSpellSlots?: Record<string, number>;
}

export interface EncounterActorDto {
  id: ActorId;
  encounterId: ActorId;
  baseType: EncounterActorBaseTypeDto;
  baseId: ActorId;
  snapshot: EncounterActorSnapshotDto;
  live: EncounterActorLiveDto;
  createdAt?: number;
  updatedAt?: number;
}

export interface FlatCharacterSheetDto {
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
  campaigns: CharacterCampaignAssignmentDto[];
  campaignSharedNotes?: string;
  conditions?: ActorConditionInstanceDto[];
  overrides?: ActorOverridesDto;
  deathSaves?: ActorDeathSavesDto;
  sharedNotes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface FlatCampaignCharacterDto {
  id: string;
  campaignId: string;
  userId?: string | null;
  characterId?: string | null;
  playerName: string;
  characterName: string;
  class: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  syncedAc?: number;
  speed?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  overrides?: ActorOverridesDto;
  conditions?: ActorConditionInstanceDto[];
  deathSaves?: ActorDeathSavesDto;
  color?: string | null;
  imageUrl?: string | null;
  sharedNotes?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface FlatEncounterActorDto {
  id: string;
  encounterId: string;
  baseType: EncounterActorBaseTypeDto;
  baseId: string;
  name: string;
  playerName?: string;
  label: string;
  color: string;
  initiative: number | null;
  friendly: boolean;
  overrides?: ActorOverridesDto;
  hpCurrent: number | null;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
  conditions: ActorConditionInstanceDto[];
  deathSaves?: ActorDeathSavesDto | null;
  usedReaction?: boolean;
  usedLegendaryActions?: number;
  usedLegendaryResistances?: number;
  usedSpellSlots?: Record<string, number>;
  createdAt?: number;
  updatedAt?: number;
}

export function flattenCharacterSheetDto(dto: CharacterSheetDto): FlatCharacterSheetDto {
  const flat: FlatCharacterSheetDto = {
    id: dto.id,
    userId: dto.userId,
    name: dto.sheet.name,
    playerName: dto.sheet.playerName,
    className: dto.sheet.className,
    species: dto.sheet.species,
    level: dto.sheet.level,
    hpMax: dto.sheet.hpMax,
    hpCurrent: dto.live.hpCurrent,
    ac: dto.sheet.ac,
    speed: dto.sheet.speed,
    strScore: dto.sheet.strScore,
    dexScore: dto.sheet.dexScore,
    conScore: dto.sheet.conScore,
    intScore: dto.sheet.intScore,
    wisScore: dto.sheet.wisScore,
    chaScore: dto.sheet.chaScore,
    color: dto.sheet.color,
    imageUrl: dto.imageUrl,
    characterData: dto.characterData,
    campaigns: dto.campaigns,
    conditions: dto.live.conditions,
    sharedNotes: dto.sharedNotes,
  };
  if (dto.campaignSharedNotes !== undefined) flat.campaignSharedNotes = dto.campaignSharedNotes;
  if (dto.live.overrides !== undefined) flat.overrides = dto.live.overrides;
  if (dto.live.deathSaves !== undefined) flat.deathSaves = dto.live.deathSaves;
  if (dto.createdAt !== undefined) flat.createdAt = dto.createdAt;
  if (dto.updatedAt !== undefined) flat.updatedAt = dto.updatedAt;
  return flat;
}

export function flattenCampaignCharacterDto(dto: CampaignCharacterDto): FlatCampaignCharacterDto {
  const flat: FlatCampaignCharacterDto = {
    id: dto.id,
    campaignId: dto.campaignId,
    playerName: dto.sheet.playerName,
    characterName: dto.sheet.characterName,
    class: dto.sheet.class,
    species: dto.sheet.species,
    level: dto.sheet.level,
    hpMax: dto.sheet.hpMax,
    hpCurrent: dto.live.hpCurrent,
    ac: dto.sheet.ac,
    conditions: dto.live.conditions,
  };
  if (dto.sheet.syncedAc !== undefined) flat.syncedAc = dto.sheet.syncedAc;
  if (dto.sheet.speed !== undefined) flat.speed = dto.sheet.speed;
  if (dto.sheet.str !== undefined) flat.str = dto.sheet.str;
  if (dto.sheet.dex !== undefined) flat.dex = dto.sheet.dex;
  if (dto.sheet.con !== undefined) flat.con = dto.sheet.con;
  if (dto.sheet.int !== undefined) flat.int = dto.sheet.int;
  if (dto.sheet.wis !== undefined) flat.wis = dto.sheet.wis;
  if (dto.sheet.cha !== undefined) flat.cha = dto.sheet.cha;
  if (dto.userId !== undefined) flat.userId = dto.userId;
  if (dto.characterId !== undefined) flat.characterId = dto.characterId;
  if (dto.live.overrides !== undefined) flat.overrides = dto.live.overrides;
  if (dto.live.deathSaves !== undefined) flat.deathSaves = dto.live.deathSaves;
  if (dto.sheet.color !== undefined) flat.color = dto.sheet.color;
  if (dto.imageUrl !== undefined) flat.imageUrl = dto.imageUrl;
  if (dto.sharedNotes !== undefined) flat.sharedNotes = dto.sharedNotes;
  if (dto.createdAt !== undefined) flat.createdAt = dto.createdAt;
  if (dto.updatedAt !== undefined) flat.updatedAt = dto.updatedAt;
  return flat;
}

export function flattenEncounterActorDto(dto: EncounterActorDto): FlatEncounterActorDto {
  const flat: FlatEncounterActorDto = {
    id: dto.id,
    encounterId: dto.encounterId,
    baseType: dto.baseType,
    baseId: dto.baseId,
    name: dto.snapshot.name,
    label: dto.snapshot.label,
    color: dto.snapshot.color,
    initiative: dto.live.initiative,
    friendly: dto.snapshot.friendly,
    hpCurrent: dto.live.hpCurrent,
    hpMax: dto.snapshot.hpMax,
    hpDetails: dto.snapshot.hpDetails,
    ac: dto.snapshot.ac,
    acDetails: dto.snapshot.acDetails,
    attackOverrides: dto.snapshot.attackOverrides,
    conditions: dto.live.conditions,
  };
  if (dto.snapshot.playerName !== undefined) flat.playerName = dto.snapshot.playerName;
  if (dto.live.overrides !== undefined) flat.overrides = dto.live.overrides;
  if (dto.live.deathSaves !== undefined) flat.deathSaves = dto.live.deathSaves;
  if (dto.live.usedReaction !== undefined) flat.usedReaction = dto.live.usedReaction;
  if (dto.live.usedLegendaryActions !== undefined) flat.usedLegendaryActions = dto.live.usedLegendaryActions;
  if (dto.live.usedLegendaryResistances !== undefined) flat.usedLegendaryResistances = dto.live.usedLegendaryResistances;
  if (dto.live.usedSpellSlots !== undefined) flat.usedSpellSlots = dto.live.usedSpellSlots;
  if (dto.createdAt !== undefined) flat.createdAt = dto.createdAt;
  if (dto.updatedAt !== undefined) flat.updatedAt = dto.updatedAt;
  return flat;
}
