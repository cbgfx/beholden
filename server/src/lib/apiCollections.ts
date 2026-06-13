import type {
  NoteDto,
  PartyInventoryItemDto,
  TreasureDto,
} from "@beholden/shared/api";
import type {
  StoredNote,
  StoredPartyInventoryItem,
  StoredTreasure,
} from "../server/userData.js";

export function toNoteDto(note: StoredNote): NoteDto {
  return {
    id: note.id,
    scope: {
      campaignId: note.campaignId,
      adventureId: note.adventureId ?? null,
    },
    content: {
      title: note.title,
      text: note.text,
    },
    meta: {
      sort: note.sort,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    },
  };
}

export function toTreasureDto(entry: StoredTreasure): TreasureDto {
  return {
    id: entry.id,
    scope: {
      campaignId: entry.campaignId,
      adventureId: entry.adventureId ?? null,
    },
    entry: {
      source: entry.source,
      itemId: entry.itemId,
      name: entry.name,
      rarity: entry.rarity,
      type: entry.type,
      typeKey: entry.type_key,
      attunement: entry.attunement,
      magic: entry.magic,
      text: entry.text,
      qty: entry.qty,
    },
    meta: {
      sort: entry.sort,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    },
  };
}

export function toPartyInventoryItemDto(
  item: StoredPartyInventoryItem,
): PartyInventoryItemDto {
  return {
    id: item.id,
    campaignId: item.campaignId,
    item: {
      name: item.name,
      quantity: item.quantity,
      weight: item.weight,
      notes: item.notes,
      source: item.source,
      itemId: item.itemId,
      rarity: item.rarity,
      type: item.type,
      description: item.description,
    },
    meta: {
      sort: item.sort,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  };
}
