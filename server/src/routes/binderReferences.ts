import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { binderEditorOrAdmin, binderReaderOrAdmin } from "../middleware/binderAuth.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { ACCEPTED_IMAGE_TYPES, deleteImageFiles, resizeToWebP } from "../lib/imageHelpers.js";
import { ensureLinkedBinderMortalForCharacter } from "../services/binders/linkedPlayerIdentity.js";
import { syncMentionField } from "./binderLore.js";

const ReferenceType = z.enum([
  "races", "positions", "domains", "organizations", "deities",
  "continents", "countries", "locations", "points-of-interest",
]);
type ReferenceType = z.infer<typeof ReferenceType>;
type RecordType =
  | "race" | "position" | "domain" | "organization" | "deity"
  | "continent" | "country" | "location" | "poi";

/** Reference types with a nullable `icon` column, storing an Iconify identifier (e.g. `game-icons:castle`). */
const ICON_ENABLED_TYPES = new Set<ReferenceType>(["organizations", "positions", "points-of-interest"]);

const config: Record<ReferenceType, {
  table:
    | "binder_races" | "binder_positions" | "binder_domains" | "binder_organizations"
    | "deities" | "binder_continents" | "binder_countries" | "binder_locations"
    | "binder_points_of_interest";
  recordType: RecordType;
  usageSql: string;
}> = {
  races: {
    table: "binder_races",
    recordType: "race",
    usageSql: "(SELECT COUNT(*) FROM mortals m WHERE m.race_id = r.id)",
  },
  positions: {
    table: "binder_positions",
    recordType: "position",
    usageSql: "(SELECT COUNT(*) FROM organization_memberships om WHERE om.position_id = r.id)",
  },
  domains: {
    table: "binder_domains",
    recordType: "domain",
    usageSql: "(SELECT COUNT(*) FROM deity_domains dd WHERE dd.domain_id = r.id)",
  },
  organizations: {
    table: "binder_organizations",
    recordType: "organization",
    usageSql: "(SELECT COUNT(*) FROM organization_memberships om WHERE om.organization_id = r.id)",
  },
  deities: {
    table: "deities",
    recordType: "deity",
    usageSql: "(SELECT COUNT(*) FROM deity_domains dd WHERE dd.deity_id = r.id)",
  },
  continents: {
    table: "binder_continents",
    recordType: "continent",
    usageSql: "(SELECT COUNT(*) FROM binder_countries country WHERE country.continent_id = r.id)",
  },
  countries: {
    table: "binder_countries",
    recordType: "country",
    usageSql: `(
      (SELECT COUNT(*) FROM binder_locations location WHERE location.country_id = r.id)
      + (SELECT COUNT(*) FROM binder_points_of_interest poi WHERE poi.country_id = r.id)
    )`,
  },
  locations: {
    table: "binder_locations",
    recordType: "location",
    usageSql: `(
      (SELECT COUNT(*) FROM mortals mortal WHERE mortal.residence_record_id = r.id)
      + (SELECT COUNT(*) FROM binder_points_of_interest poi WHERE poi.location_id = r.id)
    )`,
  },
  "points-of-interest": {
    table: "binder_points_of_interest",
    recordType: "poi",
    usageSql: `(
      (SELECT COUNT(*) FROM mortals mortal WHERE mortal.residence_record_id = r.id)
      + (SELECT COUNT(*) FROM binder_points_of_interest poi WHERE poi.parent_poi_id = r.id)
    )`,
  },
};

const optionalDescription = z.string().max(200_000).nullable().optional().transform((value) => {
  if (value === undefined || value === null) return value;
  return value.trim() === "" ? null : value;
});

const DEITY_RANKS = ["Demi God", "Lesser God", "Greater God", "Overpower"] as const;

const ReferenceCreateBody = z.object({
  name: z.string().trim().min(1).max(160),
  visibility: z.enum(["dm", "public"]).optional(),
  description: optionalDescription,
  dmNotes: optionalDescription,
  parentId: z.string().trim().min(1).nullable().optional(),
  /** Only meaningful for `organizations` — an id from `mortals` in the same Binder. */
  leaderId: z.string().trim().min(1).nullable().optional(),
  /** Only meaningful for `organizations`, `positions`, `points-of-interest` — an Iconify id, e.g. `game-icons:castle`. */
  icon: z.string().trim().min(1).max(160).nullable().optional(),
  /** Only meaningful for `deities`. */
  rank: z.enum(DEITY_RANKS).nullable().optional(),
}).strict();

const ReferencePatchBody = ReferenceCreateBody.partial().refine(
  (body) => Object.keys(body).length > 0,
  { message: "At least one field is required" },
);

type ReferenceRow = {
  id: string;
  binder_id: string;
  name: string;
  description: string | null;
  dm_notes?: string | null;
  visibility: "dm" | "campaign" | "public";
  created_at: number;
  updated_at: number;
  usage_count: number;
  continent_id?: string | null;
  country_id?: string | null;
  location_id?: string | null;
  parent_poi_id?: string | null;
  parent_name?: string | null;
  image_url?: string | null;
  image_updated_at?: number | null;
  leader_mortal_id?: string | null;
  leader_name?: string | null;
  icon?: string | null;
  rank?: string | null;
};

function parentType(row: ReferenceRow): RecordType | null {
  if (row.continent_id) return "continent";
  if (row.country_id) return "country";
  if (row.location_id) return "location";
  if (row.parent_poi_id) return "poi";
  return null;
}

function parentId(row: ReferenceRow): string | null {
  return row.continent_id ?? row.country_id ?? row.location_id ?? row.parent_poi_id ?? null;
}

type ReferenceLink = { id: string; name: string };

function dto(row: ReferenceRow, links?: { domains?: ReferenceLink[]; deities?: ReferenceLink[] }) {
  return {
    id: row.id,
    binderId: row.binder_id,
    name: row.name,
    visibility: row.visibility,
    description: row.description,
    dmNotes: row.dm_notes ?? null,
    parent: parentId(row) ? {
      id: parentId(row)!,
      name: row.parent_name ?? "",
      type: parentType(row),
    } : null,
    leader: row.leader_mortal_id ? { id: row.leader_mortal_id, name: row.leader_name ?? "" } : null,
    icon: row.icon ?? null,
    rank: row.rank ?? null,
    usageCount: row.usage_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    imageUrl: row.image_url ?? null,
    imageUpdatedAt: row.image_updated_at ?? null,
    ...(links?.domains ? { domains: links.domains } : {}),
    ...(links?.deities ? { deities: links.deities } : {}),
  };
}

function selectSql(type: ReferenceType): string {
  const entry = config[type];
  const iconColumn = ICON_ENABLED_TYPES.has(type) ? ", r.icon" : "";
  const parentColumns = (type === "countries"
    ? ", r.continent_id, parent_br.name AS parent_name"
    : type === "locations"
      ? ", r.country_id, parent_br.name AS parent_name"
      : type === "points-of-interest"
        ? ", r.location_id, r.country_id, r.parent_poi_id, parent_br.name AS parent_name"
        : type === "deities"
          ? ", r.image_url, r.image_updated_at, r.rank, r.dm_notes"
          : type === "organizations"
            ? ", r.leader_mortal_id, leader_br.name AS leader_name"
            : "") + iconColumn;
  const parentJoin = type === "countries"
    ? "LEFT JOIN binder_records parent_br ON parent_br.id = r.continent_id"
    : type === "locations"
      ? "LEFT JOIN binder_records parent_br ON parent_br.id = r.country_id"
      : type === "points-of-interest"
        ? "LEFT JOIN binder_records parent_br ON parent_br.id = COALESCE(r.location_id, r.country_id, r.parent_poi_id)"
        : type === "organizations"
          ? "LEFT JOIN binder_records leader_br ON leader_br.id = r.leader_mortal_id"
          : "";
  return `
    SELECT r.id, br.binder_id, br.name, r.description, br.visibility,
           br.created_at, br.updated_at, ${entry.usageSql} AS usage_count
           ${parentColumns}
    FROM ${entry.table} r
    JOIN binder_records br ON br.id = r.id
    ${parentJoin}
  `;
}

function resolveParent(
  db: ServerContext["db"],
  binderId: string,
  type: ReferenceType,
  parentIdValue: string | null | undefined,
  recordId?: string,
) {
  if (type === "continents" || !parentIdValue) return null;
  const allowed: Record<ReferenceType, RecordType[]> = {
    races: [], positions: [], domains: [], organizations: [], deities: [], continents: [],
    countries: ["continent"],
    locations: ["country"],
    "points-of-interest": ["location", "country", "poi"],
  };
  if (parentIdValue === recordId) throw Object.assign(new Error("A Point of Interest cannot contain itself"), { status: 400 });
  const parent = db.prepare("SELECT id, record_type FROM binder_records WHERE id = ? AND binder_id = ?")
    .get(parentIdValue, binderId) as { id: string; record_type: RecordType } | undefined;
  if (!parent || !allowed[type].includes(parent.record_type)) {
    throw Object.assign(new Error("Parent must be an allowed record from this Binder"), { status: 400 });
  }
  return parent;
}

function resolveLeaderMortal(
  db: ServerContext["db"],
  binderId: string,
  leaderIdValue: string | null | undefined,
): string | null {
  if (!leaderIdValue) return null;
  const mortal = db.prepare(`
    SELECT m.id FROM mortals m JOIN binder_records br ON br.id = m.id WHERE m.id = ? AND br.binder_id = ?
  `).get(leaderIdValue, binderId) as { id: string } | undefined;
  if (!mortal) throw Object.assign(new Error("Leader must be a Mortal from this Binder"), { status: 400 });
  return mortal.id;
}

function insertTypedRecord(db: ServerContext["db"], table: string, type: ReferenceType, id: string, description: string | null, parent: ReturnType<typeof resolveParent>, t: number, leaderId?: string | null, icon?: string | null, rank?: string | null, dmNotes?: string | null) {
  if (type === "deities") {
    db.prepare(`INSERT INTO deities (id, description, dm_notes, rank, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, description, dmNotes ?? null, rank ?? null, t, t);
  } else if (type === "countries") {
    db.prepare(`INSERT INTO binder_countries (id, continent_id, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, parent?.id ?? null, description, t, t);
  } else if (type === "locations") {
    db.prepare(`INSERT INTO binder_locations (id, country_id, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, parent?.id ?? null, description, t, t);
  } else if (type === "points-of-interest") {
    db.prepare(`INSERT INTO binder_points_of_interest (id, location_id, country_id, parent_poi_id, description, created_at, updated_at, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, parent?.record_type === "location" ? parent.id : null, parent?.record_type === "country" ? parent.id : null, parent?.record_type === "poi" ? parent.id : null, description, t, t, icon ?? null);
  } else if (type === "organizations") {
    db.prepare(`INSERT INTO binder_organizations (id, description, leader_mortal_id, created_at, updated_at, icon) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, description, leaderId ?? null, t, t, icon ?? null);
  } else if (type === "positions") {
    db.prepare(`INSERT INTO binder_positions (id, description, created_at, updated_at, icon) VALUES (?, ?, ?, ?, ?)`)
      .run(id, description, t, t, icon ?? null);
  } else {
    db.prepare(`INSERT INTO ${table} (id, description, created_at, updated_at) VALUES (?, ?, ?, ?)`)
      .run(id, description, t, t);
  }
}

function updateParent(db: ServerContext["db"], type: ReferenceType, id: string, parent: ReturnType<typeof resolveParent>) {
  if (type === "countries") db.prepare("UPDATE binder_countries SET continent_id = ? WHERE id = ?").run(parent?.id ?? null, id);
  if (type === "locations") db.prepare("UPDATE binder_locations SET country_id = ? WHERE id = ?").run(parent?.id ?? null, id);
  if (type === "points-of-interest") db.prepare(`
    UPDATE binder_points_of_interest SET location_id = ?, country_id = ?, parent_poi_id = ? WHERE id = ?
  `).run(
    parent?.record_type === "location" ? parent.id : null,
    parent?.record_type === "country" ? parent.id : null,
    parent?.record_type === "poi" ? parent.id : null,
    id,
  );
}

function updateLeader(db: ServerContext["db"], id: string, leaderId: string | null) {
  db.prepare("UPDATE binder_organizations SET leader_mortal_id = ? WHERE id = ?").run(leaderId, id);
}

function updateIcon(db: ServerContext["db"], table: string, id: string, icon: string | null) {
  db.prepare(`UPDATE ${table} SET icon = ? WHERE id = ?`).run(icon, id);
}

export function registerBinderReferenceRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const reader = binderReaderOrAdmin(db);
  const owner = binderEditorOrAdmin(db);

  app.get("/api/binders/:binderId/leader-character-options", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const rows = db.prepare(`
      SELECT uc.id, uc.name
      FROM user_characters uc
      JOIN binders b ON b.id = ?
      WHERE (uc.user_id = b.owner_user_id OR EXISTS (
        SELECT 1 FROM binder_memberships bm
        WHERE bm.binder_id = b.id AND bm.user_id = uc.user_id AND bm.role = 'collaborator'
      ))
      AND NOT EXISTS (
        SELECT 1 FROM binder_player_characters pc WHERE pc.character_id = uc.id
      )
      ORDER BY uc.name COLLATE NOCASE, uc.id
    `).all(binderId) as Array<{ id: string; name: string }>;
    res.json(rows);
  });

  app.post("/api/binders/:binderId/organizations/:organizationId/leader-character", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const organizationId = requireParam(req, res, "organizationId");
    if (!binderId || !organizationId) return;
    const { characterId } = parseBody(z.object({ characterId: z.string().trim().min(1) }).strict(), req);
    const eligible = db.prepare(`
      SELECT 1 FROM user_characters uc JOIN binders b ON b.id=?
      WHERE uc.id=? AND (uc.user_id=b.owner_user_id OR EXISTS (
        SELECT 1 FROM binder_memberships bm
        WHERE bm.binder_id=b.id AND bm.user_id=uc.user_id AND bm.role='collaborator'
      )) AND NOT EXISTS (
        SELECT 1 FROM binder_player_characters pc WHERE pc.character_id=uc.id
      )
    `).get(binderId, characterId);
    if (!eligible) return res.status(400).json({ ok: false, message: "Character is unavailable or already linked to a Binder" });
    const organization = db.prepare(`
      SELECT 1 FROM binder_organizations o JOIN binder_records br ON br.id=o.id
      WHERE o.id=? AND br.binder_id=?
    `).get(organizationId, binderId);
    if (!organization) return res.status(404).json({ ok: false, message: "Organization not found" });
    let mortalId: string | null = null;
    db.transaction(() => {
      mortalId = ensureLinkedBinderMortalForCharacter(db, characterId, ctx.helpers, binderId);
      if (!mortalId) throw new Error("Could not link character to this Binder");
      db.prepare("UPDATE binder_organizations SET leader_mortal_id=?,updated_at=? WHERE id=?")
        .run(mortalId, ctx.helpers.now(), organizationId);
    })();
    res.json({ ok: true, mortalId });
  });

  app.get("/api/binders/:binderId/organizations/:organizationId/members", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const organizationId = requireParam(req, res, "organizationId");
    if (!binderId || !organizationId) return;
    const exists = db.prepare(`
      SELECT 1 FROM binder_organizations o JOIN binder_records br ON br.id=o.id
      WHERE o.id=? AND br.binder_id=?
    `).get(organizationId, binderId);
    if (!exists) return res.status(404).json({ ok: false, message: "Organization not found" });
    const members = db.prepare(`
      SELECT mortal_record.id, mortal_record.name,
             position_record.name AS position, membership.role_label AS role
      FROM organization_memberships membership
      JOIN binder_records mortal_record ON mortal_record.id=membership.mortal_id
      LEFT JOIN binder_records position_record ON position_record.id=membership.position_id
      WHERE membership.organization_id=?
      ORDER BY mortal_record.name_key, mortal_record.id
    `).all(organizationId);
    res.json(members);
  });

  const domainsForDeityStmt = db.prepare(`
    SELECT br.id, br.name
    FROM deity_domains dd
    JOIN binder_records br ON br.id = dd.domain_id
    WHERE dd.deity_id = ?
    ORDER BY br.name_key
  `);
  const deitiesForDomainStmt = db.prepare(`
    SELECT br.id, br.name
    FROM deity_domains dd
    JOIN binder_records br ON br.id = dd.deity_id
    WHERE dd.domain_id = ?
    ORDER BY br.name_key
  `);
  const domainsForDeity = (deityId: string) => domainsForDeityStmt.all(deityId) as ReferenceLink[];
  const deitiesForDomain = (domainId: string) => deitiesForDomainStmt.all(domainId) as ReferenceLink[];
  const dtoWithLinks = (type: ReferenceType, row: ReferenceRow) =>
    type === "deities" ? dto(row, { domains: domainsForDeity(row.id) })
      : type === "domains" ? dto(row, { deities: deitiesForDomain(row.id) })
        : dto(row);

  app.get("/api/binders/:binderId/reference/:referenceType", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const query = typeof req.query.q === "string" ? ctx.helpers.normalizeKey(req.query.q) : "";
    const rows = db.prepare(`
      ${selectSql(typeResult.data)}
      WHERE br.binder_id = ?
        AND (? = '' OR br.name_key LIKE ?)
      ORDER BY br.name_key, br.id
      LIMIT 500
    `).all(binderId, query, `%${query}%`) as ReferenceRow[];
    res.json(rows.map((row) => dtoWithLinks(typeResult.data, row)));
  });

  app.get("/api/binders/:binderId/reference/:referenceType/:recordId", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const row = db.prepare(`
      ${selectSql(typeResult.data)}
      WHERE br.binder_id = ? AND r.id = ?
    `).get(binderId, recordId) as ReferenceRow | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Binder record not found" });
    res.json(dtoWithLinks(typeResult.data, row));
  });

  app.post("/api/binders/:binderId/reference/:referenceType", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const body = parseBody(ReferenceCreateBody, req);
    const entry = config[typeResult.data];
    const parent = resolveParent(db, binderId, typeResult.data, body.parentId);
    const leaderId = typeResult.data === "organizations" ? resolveLeaderMortal(db, binderId, body.leaderId) : null;
    const icon = ICON_ENABLED_TYPES.has(typeResult.data) ? body.icon ?? null : null;
    const rank = typeResult.data === "deities" ? body.rank ?? null : null;
    const defaultVisibility = ["continents", "countries", "locations"].includes(typeResult.data) ? "public" : "dm";
    const id = ctx.helpers.uid();
    const t = ctx.helpers.now();
    db.transaction(() => {
      db.prepare(`
        INSERT INTO binder_records (
          id, binder_id, record_type, name, name_key, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, binderId, entry.recordType, body.name, ctx.helpers.normalizeKey(body.name), body.visibility ?? defaultVisibility, t, t);
      insertTypedRecord(db, entry.table, typeResult.data, id, body.description ?? null, parent, t, leaderId, icon, rank, body.dmNotes ?? null);
      syncMentionField(ctx, binderId, id, "description", body.description);
      if (typeResult.data === "deities") syncMentionField(ctx, binderId, id, "dm_notes", body.dmNotes);
    })();
    const row = db.prepare(`${selectSql(typeResult.data)} WHERE r.id = ?`).get(id) as ReferenceRow;
    res.status(201).json(dtoWithLinks(typeResult.data, row));
  });

  app.patch("/api/binders/:binderId/reference/:referenceType/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const existing = db.prepare(`
      ${selectSql(typeResult.data)}
      WHERE br.binder_id = ? AND r.id = ?
    `).get(binderId, recordId) as ReferenceRow | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Binder record not found" });
    const body = parseBody(ReferencePatchBody, req);
    const parent = body.parentId !== undefined
      ? resolveParent(db, binderId, typeResult.data, body.parentId, recordId)
      : undefined;
    const leaderId = body.leaderId !== undefined && typeResult.data === "organizations"
      ? resolveLeaderMortal(db, binderId, body.leaderId)
      : undefined;
    const icon = body.icon !== undefined && ICON_ENABLED_TYPES.has(typeResult.data)
      ? body.icon ?? null
      : undefined;
    const t = ctx.helpers.now();
    db.transaction(() => {
      db.prepare(`
        UPDATE binder_records
        SET name = ?, name_key = ?, visibility = ?, updated_at = ?
        WHERE id = ? AND binder_id = ?
      `).run(
        body.name ?? existing.name,
        ctx.helpers.normalizeKey(body.name ?? existing.name),
        body.visibility ?? existing.visibility,
        t,
        recordId,
        binderId,
      );
      if (body.description !== undefined) {
        db.prepare(`UPDATE ${config[typeResult.data].table} SET description = ?, updated_at = ? WHERE id = ?`)
          .run(body.description, t, recordId);
      } else {
        db.prepare(`UPDATE ${config[typeResult.data].table} SET updated_at = ? WHERE id = ?`).run(t, recordId);
      }
      if (body.parentId !== undefined) updateParent(db, typeResult.data, recordId, parent ?? null);
      if (leaderId !== undefined) updateLeader(db, recordId, leaderId);
      if (icon !== undefined) updateIcon(db, config[typeResult.data].table, recordId, icon);
      if (body.rank !== undefined && typeResult.data === "deities") {
        db.prepare("UPDATE deities SET rank = ?, updated_at = ? WHERE id = ?").run(body.rank ?? null, t, recordId);
      }
      if (body.dmNotes !== undefined && typeResult.data === "deities") {
        db.prepare("UPDATE deities SET dm_notes = ?, updated_at = ? WHERE id = ?").run(body.dmNotes ?? null, t, recordId);
      }
      if (body.description !== undefined) syncMentionField(ctx, binderId, recordId, "description", body.description);
      if (body.dmNotes !== undefined && typeResult.data === "deities") syncMentionField(ctx, binderId, recordId, "dm_notes", body.dmNotes);
    })();
    const row = db.prepare(`${selectSql(typeResult.data)} WHERE r.id = ?`).get(recordId) as ReferenceRow;
    res.json(dtoWithLinks(typeResult.data, row));
  });

  app.delete("/api/binders/:binderId/reference/:referenceType/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const existing = db.prepare(`
      ${selectSql(typeResult.data)}
      WHERE br.binder_id = ? AND r.id = ?
    `).get(binderId, recordId) as ReferenceRow | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Binder record not found" });
    db.prepare("DELETE FROM binder_records WHERE id = ? AND binder_id = ?").run(recordId, binderId);
    if (typeResult.data === "deities") {
      deleteImageFiles(ctx, ctx.path.join(ctx.paths.dataDir, "binder-deity-images"), recordId);
    }
    res.json({ ok: true, clearedReferences: existing.usage_count });
  });

  app.post("/api/binders/:binderId/reference/deities/:recordId/image", owner, ctx.upload.single("image"), async (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const exists = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'deity'").get(recordId, binderId);
    if (!exists) return res.status(404).json({ ok: false, message: "Deity not found" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });
    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) return res.status(400).json({ ok: false, message: "Unsupported image type" });
    let image: Buffer;
    try { image = await resizeToWebP(req.file.buffer); }
    catch { return res.status(400).json({ ok: false, message: "Could not process image" }); }
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "binder-deity-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });
    deleteImageFiles(ctx, imagesDir, recordId);
    const filename = `${recordId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), image);
    const imageUrl = `/binder-deity-images/${filename}`;
    const now = ctx.helpers.now();
    db.prepare("UPDATE deities SET image_url = ?, image_updated_at = ?, updated_at = ? WHERE id = ?").run(imageUrl, now, now, recordId);
    res.json({ ok: true, imageUrl });
  });

  app.post("/api/binders/:binderId/reference/deities/:deityId/domains/:domainId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const deityId = requireParam(req, res, "deityId");
    const domainId = requireParam(req, res, "domainId");
    if (!binderId || !deityId || !domainId) return;
    const deity = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'deity'").get(deityId, binderId);
    if (!deity) return res.status(404).json({ ok: false, message: "Deity not found" });
    const domain = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'domain'").get(domainId, binderId);
    if (!domain) return res.status(404).json({ ok: false, message: "Domain not found" });
    db.prepare("INSERT OR IGNORE INTO deity_domains (deity_id, domain_id) VALUES (?, ?)").run(deityId, domainId);
    res.json({ ok: true, domains: domainsForDeity(deityId) });
  });

  app.delete("/api/binders/:binderId/reference/deities/:deityId/domains/:domainId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const deityId = requireParam(req, res, "deityId");
    const domainId = requireParam(req, res, "domainId");
    if (!binderId || !deityId || !domainId) return;
    const deity = db.prepare("SELECT 1 FROM binder_records WHERE id = ? AND binder_id = ? AND record_type = 'deity'").get(deityId, binderId);
    if (!deity) return res.status(404).json({ ok: false, message: "Deity not found" });
    db.prepare("DELETE FROM deity_domains WHERE deity_id = ? AND domain_id = ?").run(deityId, domainId);
    res.json({ ok: true, domains: domainsForDeity(deityId) });
  });
}
