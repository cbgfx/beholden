export interface NoteScopeDto {
  campaignId: string;
  adventureId: string | null;
}

export interface NoteContentDto {
  title: string;
  text: string;
}

export interface NoteMetaDto {
  sort: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface NoteDto {
  id: string;
  scope: NoteScopeDto;
  content: NoteContentDto;
  meta: NoteMetaDto;
}

export interface FlatNoteDto {
  id: string;
  scope: "campaign" | "adventure";
  scopeId: string;
  title: string;
  text: string;
  order: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface TreasureScopeDto {
  campaignId: string;
  adventureId: string | null;
}

export interface TreasureEntryDto {
  source: "compendium" | "custom";
  itemId: string | null;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
  text: string;
  qty: number;
}

export interface TreasureMetaDto {
  sort: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface TreasureDto {
  id: string;
  scope: TreasureScopeDto;
  entry: TreasureEntryDto;
  meta: TreasureMetaDto;
}

export interface FlatTreasureDto {
  id: string;
  scope: "campaign" | "adventure";
  scopeId: string;
  name: string;
  qty: number;
  order: number;
  rarity?: string;
  type?: string;
  attunement?: boolean;
  magic?: boolean;
  text?: string;
  itemId?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface PartyInventoryItemContentDto {
  name: string;
  quantity: number;
  weight: number | null;
  notes: string;
  source: string | null;
  itemId: string | null;
  rarity: string | null;
  type: string | null;
  description: string | null;
}

export interface PartyInventoryMetaDto {
  sort: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface PartyInventoryItemDto {
  id: string;
  campaignId: string;
  item: PartyInventoryItemContentDto;
  meta: PartyInventoryMetaDto;
}

export interface FlatPartyInventoryItemDto {
  id: string;
  campaignId: string;
  name: string;
  quantity: number;
  weight: number | null;
  notes: string;
  source: string | null;
  itemId: string | null;
  rarity: string | null;
  type: string | null;
  description: string | null;
  sort: number;
  createdAt?: number;
  updatedAt?: number;
}

export function flattenNoteDto(dto: NoteDto): FlatNoteDto {
  const flat: FlatNoteDto = {
    id: dto.id,
    scope: dto.scope.adventureId ? "adventure" : "campaign",
    scopeId: dto.scope.adventureId ?? dto.scope.campaignId,
    title: dto.content.title,
    text: dto.content.text,
    order: dto.meta.sort,
  };
  if (dto.meta.createdAt !== undefined) flat.createdAt = dto.meta.createdAt;
  if (dto.meta.updatedAt !== undefined) flat.updatedAt = dto.meta.updatedAt;
  return flat;
}

export function flattenTreasureDto(dto: TreasureDto): FlatTreasureDto {
  const flat: FlatTreasureDto = {
    id: dto.id,
    scope: dto.scope.adventureId ? "adventure" : "campaign",
    scopeId: dto.scope.adventureId ?? dto.scope.campaignId,
    name: dto.entry.name,
    qty: dto.entry.qty,
    order: dto.meta.sort,
  };
  if (dto.entry.rarity) flat.rarity = dto.entry.rarity;
  if (dto.entry.type) flat.type = dto.entry.type;
  if (dto.entry.attunement) flat.attunement = dto.entry.attunement;
  if (dto.entry.magic) flat.magic = dto.entry.magic;
  if (dto.entry.text) flat.text = dto.entry.text;
  if (dto.entry.itemId !== undefined) flat.itemId = dto.entry.itemId;
  if (dto.meta.createdAt !== undefined) flat.createdAt = dto.meta.createdAt;
  if (dto.meta.updatedAt !== undefined) flat.updatedAt = dto.meta.updatedAt;
  return flat;
}

export function flattenPartyInventoryItemDto(
  dto: PartyInventoryItemDto,
): FlatPartyInventoryItemDto {
  const flat: FlatPartyInventoryItemDto = {
    id: dto.id,
    campaignId: dto.campaignId,
    name: dto.item.name,
    quantity: dto.item.quantity,
    weight: dto.item.weight,
    notes: dto.item.notes,
    source: dto.item.source,
    itemId: dto.item.itemId,
    rarity: dto.item.rarity,
    type: dto.item.type,
    description: dto.item.description,
    sort: dto.meta.sort,
  };
  if (dto.meta.createdAt !== undefined) flat.createdAt = dto.meta.createdAt;
  if (dto.meta.updatedAt !== undefined) flat.updatedAt = dto.meta.updatedAt;
  return flat;
}
