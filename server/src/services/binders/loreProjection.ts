import type { Db } from "../../lib/db.js";
import type { ServerContext } from "../../server/context.js";
import { requireBinderRecord } from "./lore.js";

export type BinderAssociation = {
  id: string;
  role?: string | null | undefined;
  description?: string | null | undefined;
};

export const ITEM_SELECT = `
  SELECT br.id, br.binder_id, br.name, bi.description, bi.dm_notes,
         bi.compendium_item_id, ci.name AS compendium_item_name,
         bi.holder_mortal_id, holder.name AS holder_name,
         bi.location_record_id, location.name AS location_name,
         br.created_at, br.updated_at
  FROM binder_items bi
  JOIN binder_records br ON br.id = bi.id
  LEFT JOIN compendium_items ci ON ci.id = bi.compendium_item_id
  LEFT JOIN binder_records holder ON holder.id = bi.holder_mortal_id
  LEFT JOIN binder_records location ON location.id = bi.location_record_id
`;

export function toEventDto(db: Db, row: Record<string, unknown>) {
  const id = String(row.id);
  const records = db.prepare(`
    SELECT ber.record_id AS id, br.name, br.record_type AS type, ber.role, ber.description
    FROM binder_event_records ber JOIN binder_records br ON br.id = ber.record_id
    WHERE ber.event_id = ? ORDER BY ber.sort, br.name_key
  `).all(id);
  const campaigns = db.prepare(`
    SELECT bec.campaign_id AS id, c.name, bec.role, bec.description
    FROM binder_event_campaigns bec JOIN campaigns c ON c.id = bec.campaign_id
    WHERE bec.event_id = ? ORDER BY c.name
  `).all(id);
  const tags = db.prepare(`
    SELECT et.id, et.name FROM binder_event_tag_links etl
    JOIN binder_event_tags et ON et.id = etl.tag_id
    WHERE etl.event_id = ? ORDER BY et.name_key
  `).all(id);
  return { ...row, records, campaigns, tags };
}

export function replaceEventTags(ctx: ServerContext, binderId: string, eventId: string, tags?: string[]) {
  if (!tags) return;
  ctx.db.prepare("DELETE FROM binder_event_tag_links WHERE event_id = ?").run(eventId);
  const now = ctx.helpers.now();
  const find = ctx.db.prepare("SELECT id FROM binder_event_tags WHERE binder_id = ? AND name_key = ?");
  const create = ctx.db.prepare("INSERT INTO binder_event_tags (id,binder_id,name,name_key,created_at,updated_at) VALUES (?,?,?,?,?,?)");
  const link = ctx.db.prepare("INSERT OR IGNORE INTO binder_event_tag_links (event_id,tag_id) VALUES (?,?)");
  const seen = new Set<string>();
  for (const name of tags) {
    const key = ctx.helpers.normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let row = find.get(binderId, key) as { id: string } | undefined;
    if (!row) {
      row = { id: ctx.helpers.uid() };
      create.run(row.id, binderId, name.trim(), key, now, now);
    }
    link.run(eventId, row.id);
  }
}

export function replaceEventAssociations(ctx: ServerContext, binderId: string, eventId: string, records?: BinderAssociation[], campaigns?: BinderAssociation[]) {
  if (records) {
    ctx.db.prepare("DELETE FROM binder_event_records WHERE event_id = ?").run(eventId);
    const insert = ctx.db.prepare("INSERT INTO binder_event_records (id,event_id,record_id,role,description,sort) VALUES (?,?,?,?,?,?)");
    records.forEach((entry, index) => {
      requireBinderRecord(ctx.db, binderId, entry.id);
      if (entry.id === eventId) throw Object.assign(new Error("An Event cannot associate itself"), { status: 400 });
      insert.run(ctx.helpers.uid(), eventId, entry.id, entry.role ?? null, entry.description ?? null, index);
    });
  }
  if (campaigns) {
    ctx.db.prepare("DELETE FROM binder_event_campaigns WHERE event_id = ?").run(eventId);
    const insert = ctx.db.prepare("INSERT INTO binder_event_campaigns (id,event_id,campaign_id,role,description) VALUES (?,?,?,?,?)");
    for (const entry of campaigns) {
      const campaign = ctx.db.prepare("SELECT id FROM campaigns WHERE id = ? AND binder_id = ?").get(entry.id, binderId);
      if (!campaign) throw Object.assign(new Error("Campaign must belong to this Binder"), { status: 400 });
      insert.run(ctx.helpers.uid(), eventId, entry.id, entry.role ?? null, entry.description ?? null);
    }
  }
}
