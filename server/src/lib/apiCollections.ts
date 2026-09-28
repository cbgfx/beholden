import { createHash } from "node:crypto";
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

/**
 * The lighter form used by list views: the same shape as a whole note, with the text left out.
 *
 * It used to be its own flat object, so the same note arrived in two different shapes depending on
 * which endpoint you asked, and each client kept a converter for the other one.
 */
export function toNoteSummaryDto(row: Record<string, unknown>): NoteDto {
  const displayTitle = String(row.title ?? "Note");
  const summary: NoteDto = {
    id: row.id as string,
    scope: {
      campaignId: row.campaign_id as string,
      adventureId: (row.adventure_id as string | null) ?? null,
    },
    content: {
      title: displayTitle,
      text: "",
      titleIsDerived: displayTitle !== row.raw_title,
    },
    meta: { sort: (row.sort as number) ?? 0 },
  };
  if (typeof row.created_at === "number") summary.meta.createdAt = row.created_at;
  if (typeof row.updated_at === "number") summary.meta.updatedAt = row.updated_at;
  return summary;
}

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
      titleIsDerived: note.titleIsDerived,
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
      encounterId: entry.encounterId ?? null,
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
      ...(item.payload ? { payload: item.payload } : {}),
    },
    meta: {
      revision: createHash("sha256").update(JSON.stringify(item)).digest("hex"),
      sort: item.sort,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
  };
}
