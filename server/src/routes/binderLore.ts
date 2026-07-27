import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { binderOwnerOrAdmin, binderReaderOrAdmin } from "../middleware/binderAuth.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";

const optionalText = (max = 200_000) => z.string().max(max).nullable().optional().transform((value) => {
  if (value == null) return value;
  return value.trim() || null;
});
const nullableId = z.string().trim().min(1).nullable().optional();
const association = z.object({
  id: z.string().trim().min(1),
  role: optionalText(100),
  description: optionalText(2_000),
}).strict();

const ItemBody = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalText(),
  dmNotes: optionalText(),
  compendiumItemId: nullableId,
  holderMortalId: nullableId,
  locationRecordId: nullableId,
}).strict();
const ItemPatch = ItemBody.partial().refine((body) => Object.keys(body).length > 0);

const EventBody = z.object({
  title: z.string().trim().min(1).max(200),
  description: optionalText(),
  dateText: optionalText(100),
  dateSort: z.number().int().nullable().optional(),
  endDateText: optionalText(100),
  endDateSort: z.number().int().nullable().optional(),
  records: z.array(association).max(500).optional(),
  campaigns: z.array(association).max(100).optional(),
}).strict();
const EventPatch = EventBody.partial().refine((body) => Object.keys(body).length > 0);

const RelationshipBody = z.object({
  sourceRecordId: z.string().trim().min(1),
  targetRecordId: z.string().trim().min(1),
  category: z.enum([
    "family", "friend", "enemy", "rival", "ally", "mentor", "student",
    "spouse", "parent", "child", "sibling", "other",
  ]),
  sourceLabel: optionalText(100),
  targetLabel: optionalText(100),
  isSymmetric: z.boolean().optional(),
  startDateText: optionalText(100),
  startDateSort: z.number().int().nullable().optional(),
  endDateText: optionalText(100),
  endDateSort: z.number().int().nullable().optional(),
  notes: optionalText(10_000),
}).strict();
const MentionSyncBody = z.object({
  sourceRecordId: z.string().trim().min(1),
  sourceField: z.string().trim().min(1).max(100),
  text: z.string().max(200_000).nullable(),
}).strict();

type RecordRow = {
  id: string; binder_id: string; record_type: string; name: string;
};

function requireBinderRecord(
  db: ServerContext["db"],
  binderId: string,
  id: string | null | undefined,
  allowed?: string[],
) {
  if (!id) return null;
  const row = db.prepare(
    "SELECT id, binder_id, record_type, name FROM binder_records WHERE id = ? AND binder_id = ?",
  ).get(id, binderId) as RecordRow | undefined;
  if (!row || (allowed && !allowed.includes(row.record_type))) {
    throw Object.assign(new Error("Referenced record is invalid or belongs to another Binder"), { status: 400 });
  }
  return row;
}

function routeFor(type: string, binderId: string, id: string) {
  const section: Record<string, string> = {
    mortal: "mortals", deity: "deities", race: "races", position: "positions",
    domain: "domains", organization: "organizations", continent: "continents",
    country: "countries", location: "locations", poi: "points-of-interest",
    item: "items", event: "events",
  };
  return `/binder/${binderId}/${section[type] ?? type}/${id}`;
}

function syncMentionField(ctx: ServerContext, binderId: string, sourceRecordId: string, sourceField: string, value: string | null | undefined) {
  ctx.db.prepare("DELETE FROM binder_record_mentions WHERE source_record_id=? AND source_field=?").run(sourceRecordId, sourceField);
  if (!value) return;
  const pattern = /\[([^\]]+)\]\(\/binder\/[^/]+\/[^/]+\/([^/?#)]+)[^)]*\)/g;
  const insert = ctx.db.prepare(`
    INSERT INTO binder_record_mentions
      (id,source_record_id,source_field,target_record_id,target_external_id,label,occurrence_key,created_at)
    VALUES (?,?,?,?,NULL,?,?,?)
  `);
  let match: RegExpExecArray | null; let occurrence = 0;
  while ((match = pattern.exec(value)) !== null) {
    const target = requireBinderRecord(ctx.db, binderId, decodeURIComponent(match[2]!));
    if (!target) continue;
    insert.run(ctx.helpers.uid(), sourceRecordId, sourceField, target.id, match[1]!.replace(/^@/, ""), `${target.id}:${occurrence++}`, ctx.helpers.now());
  }
}

function itemSelect() {
  return `
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
}

function eventDto(db: ServerContext["db"], row: Record<string, unknown>) {
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
  return { ...row, records, campaigns };
}

function replaceEventAssociations(
  ctx: ServerContext,
  binderId: string,
  eventId: string,
  records?: Array<z.infer<typeof association>>,
  campaigns?: Array<z.infer<typeof association>>,
) {
  if (records) {
    ctx.db.prepare("DELETE FROM binder_event_records WHERE event_id = ?").run(eventId);
    const insert = ctx.db.prepare(
      "INSERT INTO binder_event_records (id,event_id,record_id,role,description,sort) VALUES (?,?,?,?,?,?)",
    );
    records.forEach((entry, index) => {
      requireBinderRecord(ctx.db, binderId, entry.id);
      if (entry.id === eventId) throw Object.assign(new Error("An Event cannot associate itself"), { status: 400 });
      insert.run(ctx.helpers.uid(), eventId, entry.id, entry.role ?? null, entry.description ?? null, index);
    });
  }
  if (campaigns) {
    ctx.db.prepare("DELETE FROM binder_event_campaigns WHERE event_id = ?").run(eventId);
    const insert = ctx.db.prepare(
      "INSERT INTO binder_event_campaigns (id,event_id,campaign_id,role,description) VALUES (?,?,?,?,?)",
    );
    for (const entry of campaigns) {
      const campaign = ctx.db.prepare("SELECT id FROM campaigns WHERE id = ? AND binder_id = ?").get(entry.id, binderId);
      if (!campaign) throw Object.assign(new Error("Campaign must belong to this Binder"), { status: 400 });
      insert.run(ctx.helpers.uid(), eventId, entry.id, entry.role ?? null, entry.description ?? null);
    }
  }
}

export function registerBinderLoreRoutes(app: Express, ctx: ServerContext) {
  const reader = binderReaderOrAdmin(ctx.db);
  const owner = binderOwnerOrAdmin(ctx.db);

  app.get("/api/binders/:binderId/records", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const query = typeof req.query.q === "string" ? ctx.helpers.normalizeKey(req.query.q) : "";
    const types = typeof req.query.types === "string"
      ? req.query.types.split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    const rows = ctx.db.prepare(`
      SELECT id, binder_id, record_type, name
      FROM binder_records
      WHERE binder_id = ?
        AND (? = '' OR name_key LIKE ?)
      ORDER BY name_key, id LIMIT 500
    `).all(binderId, query, `%${query}%`) as RecordRow[];
    res.json(rows.filter((row) => !types.length || types.includes(row.record_type)).map((row) => ({
      id: row.id, binderId: row.binder_id, type: row.record_type, name: row.name,
      route: routeFor(row.record_type, binderId, row.id),
    })));
  });
  app.put("/api/binders/:binderId/mentions", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const body = parseBody(MentionSyncBody, req);
    requireBinderRecord(ctx.db, binderId, body.sourceRecordId);
    ctx.db.transaction(() => syncMentionField(ctx, binderId, body.sourceRecordId, body.sourceField, body.text))();
    res.json({ ok: true });
  });

  app.get("/api/binders/:binderId/items", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    res.json(ctx.db.prepare(`${itemSelect()} WHERE br.binder_id = ? ORDER BY br.name_key`).all(binderId));
  });
  app.post("/api/binders/:binderId/items", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const body = parseBody(ItemBody, req);
    requireBinderRecord(ctx.db, binderId, body.holderMortalId, ["mortal"]);
    requireBinderRecord(ctx.db, binderId, body.locationRecordId, ["continent", "country", "location", "poi"]);
    if (body.compendiumItemId && !ctx.db.prepare("SELECT 1 FROM compendium_items WHERE id = ?").get(body.compendiumItemId)) {
      return res.status(400).json({ ok: false, message: "Compendium Item does not exist" });
    }
    const id = ctx.helpers.uid(); const t = ctx.helpers.now();
    ctx.db.transaction(() => {
      ctx.db.prepare("INSERT INTO binder_records (id,binder_id,record_type,name,name_key,visibility,created_at,updated_at) VALUES (?,?,?,?,?,'dm',?,?)")
        .run(id, binderId, "item", body.name, ctx.helpers.normalizeKey(body.name), t, t);
      ctx.db.prepare("INSERT INTO binder_items (id,description,dm_notes,compendium_item_id,holder_mortal_id,location_record_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(id, body.description ?? null, body.dmNotes ?? null, body.compendiumItemId ?? null, body.holderMortalId ?? null, body.locationRecordId ?? null, t, t);
      syncMentionField(ctx, binderId, id, "description", body.description);
      syncMentionField(ctx, binderId, id, "dm_notes", body.dmNotes);
    })();
    res.status(201).json(ctx.db.prepare(`${itemSelect()} WHERE br.id = ?`).get(id));
  });
  app.patch("/api/binders/:binderId/items/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); const id = requireParam(req, res, "recordId");
    if (!binderId || !id) return;
    const body = parseBody(ItemPatch, req);
    const old = ctx.db.prepare(`${itemSelect()} WHERE br.id = ? AND br.binder_id = ?`).get(id, binderId) as Record<string, unknown> | undefined;
    if (!old) return res.status(404).json({ ok: false, message: "Item not found" });
    requireBinderRecord(ctx.db, binderId, body.holderMortalId, ["mortal"]);
    requireBinderRecord(ctx.db, binderId, body.locationRecordId, ["continent", "country", "location", "poi"]);
    if (body.compendiumItemId && !ctx.db.prepare("SELECT 1 FROM compendium_items WHERE id = ?").get(body.compendiumItemId)) {
      return res.status(400).json({ ok: false, message: "Compendium Item does not exist" });
    }
    const t = ctx.helpers.now();
    ctx.db.transaction(() => {
      const name = body.name ?? String(old.name);
      ctx.db.prepare("UPDATE binder_records SET name=?,name_key=?,updated_at=? WHERE id=?")
        .run(name, ctx.helpers.normalizeKey(name), t, id);
      ctx.db.prepare(`UPDATE binder_items SET description=?,dm_notes=?,compendium_item_id=?,holder_mortal_id=?,location_record_id=?,updated_at=? WHERE id=?`)
        .run(body.description !== undefined ? body.description : old.description, body.dmNotes !== undefined ? body.dmNotes : old.dm_notes,
          body.compendiumItemId !== undefined ? body.compendiumItemId : old.compendium_item_id,
          body.holderMortalId !== undefined ? body.holderMortalId : old.holder_mortal_id,
          body.locationRecordId !== undefined ? body.locationRecordId : old.location_record_id, t, id);
      syncMentionField(ctx, binderId, id, "description", body.description !== undefined ? body.description : old.description as string | null);
      syncMentionField(ctx, binderId, id, "dm_notes", body.dmNotes !== undefined ? body.dmNotes : old.dm_notes as string | null);
    })();
    res.json(ctx.db.prepare(`${itemSelect()} WHERE br.id = ?`).get(id));
  });
  app.delete("/api/binders/:binderId/items/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); const id = requireParam(req, res, "recordId");
    if (!binderId || !id) return;
    const result = ctx.db.prepare("DELETE FROM binder_records WHERE id=? AND binder_id=? AND record_type='item'").run(id, binderId);
    if (!result.changes) return res.status(404).json({ ok: false, message: "Item not found" });
    res.json({ ok: true });
  });

  app.get("/api/binders/:binderId/events", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const rows = ctx.db.prepare(`
      SELECT br.id, br.name AS title, be.description, be.date_text AS dateText, be.date_sort AS dateSort,
             be.end_date_text AS endDateText, be.end_date_sort AS endDateSort, br.created_at AS createdAt, br.updated_at AS updatedAt
      FROM binder_events be JOIN binder_records br ON br.id=be.id
      WHERE br.binder_id=? ORDER BY COALESCE(be.date_sort, 9223372036854775807), br.name_key
    `).all(binderId) as Array<Record<string, unknown>>;
    res.json(rows.map((row) => eventDto(ctx.db, row)));
  });
  app.post("/api/binders/:binderId/events", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const body = parseBody(EventBody, req); const id = ctx.helpers.uid(); const t = ctx.helpers.now();
    ctx.db.transaction(() => {
      ctx.db.prepare("INSERT INTO binder_records (id,binder_id,record_type,name,name_key,visibility,created_at,updated_at) VALUES (?,?,?,?,?,'dm',?,?)")
        .run(id, binderId, "event", body.title, ctx.helpers.normalizeKey(body.title), t, t);
      ctx.db.prepare("INSERT INTO binder_events (id,description,date_text,date_sort,end_date_text,end_date_sort,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(id, body.description ?? null, body.dateText ?? null, body.dateSort ?? null, body.endDateText ?? null, body.endDateSort ?? null, t, t);
      replaceEventAssociations(ctx, binderId, id, body.records, body.campaigns);
      syncMentionField(ctx, binderId, id, "description", body.description);
    })();
    const row = ctx.db.prepare("SELECT br.id,br.name AS title,be.description,be.date_text AS dateText,be.date_sort AS dateSort,be.end_date_text AS endDateText,be.end_date_sort AS endDateSort FROM binder_events be JOIN binder_records br ON br.id=be.id WHERE br.id=?").get(id) as Record<string, unknown>;
    res.status(201).json(eventDto(ctx.db, row));
  });
  app.patch("/api/binders/:binderId/events/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); const id = requireParam(req, res, "recordId"); if (!binderId || !id) return;
    const body = parseBody(EventPatch, req);
    const old = ctx.db.prepare("SELECT br.name,be.* FROM binder_events be JOIN binder_records br ON br.id=be.id WHERE br.id=? AND br.binder_id=?").get(id, binderId) as Record<string, unknown> | undefined;
    if (!old) return res.status(404).json({ ok: false, message: "Event not found" });
    const t = ctx.helpers.now();
    ctx.db.transaction(() => {
      const title = body.title ?? String(old.name);
      ctx.db.prepare("UPDATE binder_records SET name=?,name_key=?,updated_at=? WHERE id=?").run(title, ctx.helpers.normalizeKey(title), t, id);
      ctx.db.prepare("UPDATE binder_events SET description=?,date_text=?,date_sort=?,end_date_text=?,end_date_sort=?,updated_at=? WHERE id=?")
        .run(body.description !== undefined ? body.description : old.description, body.dateText !== undefined ? body.dateText : old.date_text,
          body.dateSort !== undefined ? body.dateSort : old.date_sort, body.endDateText !== undefined ? body.endDateText : old.end_date_text,
          body.endDateSort !== undefined ? body.endDateSort : old.end_date_sort, t, id);
      replaceEventAssociations(ctx, binderId, id, body.records, body.campaigns);
      syncMentionField(ctx, binderId, id, "description", body.description !== undefined ? body.description : old.description as string | null);
    })();
    const row = ctx.db.prepare("SELECT br.id,br.name AS title,be.description,be.date_text AS dateText,be.date_sort AS dateSort,be.end_date_text AS endDateText,be.end_date_sort AS endDateSort FROM binder_events be JOIN binder_records br ON br.id=be.id WHERE br.id=?").get(id) as Record<string, unknown>;
    res.json(eventDto(ctx.db, row));
  });
  app.delete("/api/binders/:binderId/events/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); const id = requireParam(req, res, "recordId"); if (!binderId || !id) return;
    const result = ctx.db.prepare("DELETE FROM binder_records WHERE id=? AND binder_id=? AND record_type='event'").run(id, binderId);
    if (!result.changes) return res.status(404).json({ ok: false, message: "Event not found" });
    res.json({ ok: true });
  });

  app.get("/api/binders/:binderId/relationships", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const recordId = typeof req.query.recordId === "string" ? req.query.recordId : null;
    res.json(ctx.db.prepare(`
      SELECT r.id,r.source_record_id AS sourceRecordId,s.name AS sourceName,s.record_type AS sourceType,
             r.target_record_id AS targetRecordId,t.name AS targetName,t.record_type AS targetType,
             r.category,r.source_label AS sourceLabel,r.target_label AS targetLabel,
             r.is_symmetric AS isSymmetric,r.start_date_text AS startDateText,r.start_date_sort AS startDateSort,
             r.end_date_text AS endDateText,r.end_date_sort AS endDateSort,r.notes
      FROM binder_relationships r
      JOIN binder_records s ON s.id=r.source_record_id JOIN binder_records t ON t.id=r.target_record_id
      WHERE r.binder_id=? AND (? IS NULL OR r.source_record_id=? OR r.target_record_id=?)
      ORDER BY r.updated_at DESC
    `).all(binderId, recordId, recordId, recordId));
  });
  app.post("/api/binders/:binderId/relationships", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); if (!binderId) return;
    const body = parseBody(RelationshipBody, req);
    requireBinderRecord(ctx.db, binderId, body.sourceRecordId);
    requireBinderRecord(ctx.db, binderId, body.targetRecordId);
    if (body.sourceRecordId === body.targetRecordId) return res.status(400).json({ ok: false, message: "A record cannot relate to itself" });
    let source = body.sourceRecordId; let target = body.targetRecordId;
    const symmetric = body.isSymmetric ?? ["family", "friend", "enemy", "rival", "ally", "spouse", "sibling"].includes(body.category);
    if (symmetric && source > target) [source, target] = [target, source];
    const id = ctx.helpers.uid(); const t = ctx.helpers.now();
    ctx.db.prepare(`INSERT INTO binder_relationships
      (id,binder_id,source_record_id,target_record_id,category,source_label,target_label,is_symmetric,start_date_text,start_date_sort,end_date_text,end_date_sort,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,binderId,source,target,body.category,body.sourceLabel ?? null,body.targetLabel ?? null,symmetric ? 1 : 0,
        body.startDateText ?? null,body.startDateSort ?? null,body.endDateText ?? null,body.endDateSort ?? null,body.notes ?? null,t,t);
    res.status(201).json({ id });
  });
  app.delete("/api/binders/:binderId/relationships/:relationshipId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId"); const id = requireParam(req, res, "relationshipId"); if (!binderId || !id) return;
    const result = ctx.db.prepare("DELETE FROM binder_relationships WHERE id=? AND binder_id=?").run(id,binderId);
    if (!result.changes) return res.status(404).json({ ok:false,message:"Relationship not found" });
    res.json({ ok:true });
  });
}
