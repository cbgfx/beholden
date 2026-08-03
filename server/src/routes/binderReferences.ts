import type { Express } from "express";
import { z } from "zod";
import type { ServerContext } from "../server/context.js";
import { binderEditorOrAdmin, binderReaderOrAdmin } from "../middleware/binderAuth.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { deleteImageFiles, prepareUploadedImage } from "../lib/imageHelpers.js";
import { ensureLinkedBinderMortalForCharacter } from "../services/binders/linkedPlayerIdentity.js";
import { syncMentionField } from "../services/binders/lore.js";
import { EntityNameSchema } from "../lib/schemas.js";
import {
  insertReferenceRecord,
  referenceSelectSql,
  resolveOrganizationLeader,
  resolveReferenceParent,
  toReferenceDto,
  updateOrganizationLeader,
  updateReferenceIcon,
  updateReferenceParent,
  type ReferenceConfig,
} from "../services/binders/references.js";

const ReferenceType = z.enum([
  "races", "positions", "domains", "organizations", "deities",
  "continents", "countries", "locations", "points-of-interest",
]);
type ReferenceType = z.infer<typeof ReferenceType>;
/** Reference types with a nullable `icon` column, storing an Iconify identifier (e.g. `game-icons:castle`). */
const ICON_ENABLED_TYPES = new Set<ReferenceType>(["organizations", "positions", "points-of-interest"]);

const config: Record<ReferenceType, ReferenceConfig> = {
  races: {
    table: "binder_races",
    recordType: "race",
    usageSql: "(SELECT COUNT(*) FROM mortals m WHERE m.race_id = r.id)",
  },
  positions: {
    table: "binder_positions",
    recordType: "position",
    usageSql: "(SELECT COUNT(*) FROM mortals m WHERE m.position_id = r.id)",
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
  name: EntityNameSchema,
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

type ReferenceLink = { id: string; name: string };

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
      JOIN mortals mortal ON mortal.id=membership.mortal_id
      LEFT JOIN binder_records position_record ON position_record.id=mortal.position_id
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
    type === "deities" ? toReferenceDto(row, { domains: domainsForDeity(row.id) })
      : type === "domains" ? toReferenceDto(row, { deities: deitiesForDomain(row.id) })
        : toReferenceDto(row);

  app.get("/api/binders/:binderId/reference/:referenceType", reader, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    if (!binderId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const query = typeof req.query.q === "string" ? ctx.helpers.normalizeKey(req.query.q) : "";
    const rows = db.prepare(`
      ${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))}
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
      ${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))}
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
    const parent = resolveReferenceParent(db, binderId, typeResult.data, body.parentId);
    const leaderId = typeResult.data === "organizations" ? resolveOrganizationLeader(db, binderId, body.leaderId) : null;
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
      insertReferenceRecord(db, entry.table, typeResult.data, id, body.description ?? null, parent, t, leaderId, icon, rank, body.dmNotes ?? null);
      syncMentionField(ctx, binderId, id, "description", body.description);
      if (typeResult.data === "deities") syncMentionField(ctx, binderId, id, "dm_notes", body.dmNotes);
    })();
    const row = db.prepare(`${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))} WHERE r.id = ?`).get(id) as ReferenceRow;
    res.status(201).json(dtoWithLinks(typeResult.data, row));
  });

  app.patch("/api/binders/:binderId/reference/:referenceType/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const existing = db.prepare(`
      ${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))}
      WHERE br.binder_id = ? AND r.id = ?
    `).get(binderId, recordId) as ReferenceRow | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: "Binder record not found" });
    const body = parseBody(ReferencePatchBody, req);
    const parent = body.parentId !== undefined
      ? resolveReferenceParent(db, binderId, typeResult.data, body.parentId, recordId)
      : undefined;
    const leaderId = body.leaderId !== undefined && typeResult.data === "organizations"
      ? resolveOrganizationLeader(db, binderId, body.leaderId)
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
      if (body.parentId !== undefined) updateReferenceParent(db, typeResult.data, recordId, parent ?? null);
      if (leaderId !== undefined) updateOrganizationLeader(db, recordId, leaderId);
      if (icon !== undefined) updateReferenceIcon(db, config[typeResult.data].table, recordId, icon);
      if (body.rank !== undefined && typeResult.data === "deities") {
        db.prepare("UPDATE deities SET rank = ?, updated_at = ? WHERE id = ?").run(body.rank ?? null, t, recordId);
      }
      if (body.dmNotes !== undefined && typeResult.data === "deities") {
        db.prepare("UPDATE deities SET dm_notes = ?, updated_at = ? WHERE id = ?").run(body.dmNotes ?? null, t, recordId);
      }
      if (body.description !== undefined) syncMentionField(ctx, binderId, recordId, "description", body.description);
      if (body.dmNotes !== undefined && typeResult.data === "deities") syncMentionField(ctx, binderId, recordId, "dm_notes", body.dmNotes);
    })();
    const row = db.prepare(`${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))} WHERE r.id = ?`).get(recordId) as ReferenceRow;
    res.json(dtoWithLinks(typeResult.data, row));
  });

  app.delete("/api/binders/:binderId/reference/:referenceType/:recordId", owner, (req, res) => {
    const binderId = requireParam(req, res, "binderId");
    const recordId = requireParam(req, res, "recordId");
    if (!binderId || !recordId) return;
    const typeResult = ReferenceType.safeParse(req.params.referenceType);
    if (!typeResult.success) return res.status(404).json({ ok: false, message: "Reference type not found" });
    const existing = db.prepare(`
      ${referenceSelectSql(typeResult.data, config[typeResult.data], ICON_ENABLED_TYPES.has(typeResult.data))}
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
    const prepared = await prepareUploadedImage(req.file);
    if (!prepared.ok) return res.status(400).json({ ok: false, message: prepared.message });
    const image = prepared.image;
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
