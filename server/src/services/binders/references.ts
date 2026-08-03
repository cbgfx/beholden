import type { Db } from "../../lib/db.js";

export type ReferenceType = "races" | "positions" | "domains" | "organizations" | "deities" | "continents" | "countries" | "locations" | "points-of-interest";
export type RecordType = "race" | "position" | "domain" | "organization" | "deity" | "continent" | "country" | "location" | "poi";
export type ReferenceTable = "binder_races" | "binder_positions" | "binder_domains" | "binder_organizations" | "deities" | "binder_continents" | "binder_countries" | "binder_locations" | "binder_points_of_interest";
export type ReferenceConfig = { table: ReferenceTable; recordType: RecordType; usageSql: string };
export type ReferenceRow = {
  id: string; binder_id: string; name: string; description: string | null; dm_notes?: string | null;
  visibility: "dm" | "campaign" | "public"; created_at: number; updated_at: number; usage_count: number;
  continent_id?: string | null; country_id?: string | null; location_id?: string | null;
  parent_poi_id?: string | null; parent_name?: string | null; image_url?: string | null;
  image_updated_at?: number | null; leader_mortal_id?: string | null; leader_name?: string | null;
  icon?: string | null; rank?: string | null;
};
export type ReferenceLink = { id: string; name: string };
export type ResolvedParent = { id: string; record_type: RecordType } | null;

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

export function toReferenceDto(row: ReferenceRow, links?: { domains?: ReferenceLink[]; deities?: ReferenceLink[] }) {
  const resolvedParentId = parentId(row);
  return {
    id: row.id, binderId: row.binder_id, name: row.name, visibility: row.visibility,
    description: row.description, dmNotes: row.dm_notes ?? null,
    parent: resolvedParentId ? { id: resolvedParentId, name: row.parent_name ?? "", type: parentType(row) } : null,
    leader: row.leader_mortal_id ? { id: row.leader_mortal_id, name: row.leader_name ?? "" } : null,
    icon: row.icon ?? null, rank: row.rank ?? null, usageCount: row.usage_count,
    createdAt: row.created_at, updatedAt: row.updated_at,
    imageUrl: row.image_url ?? null, imageUpdatedAt: row.image_updated_at ?? null,
    ...(links?.domains ? { domains: links.domains } : {}),
    ...(links?.deities ? { deities: links.deities } : {}),
  };
}

export function referenceSelectSql(type: ReferenceType, entry: ReferenceConfig, iconEnabled: boolean): string {
  const iconColumn = iconEnabled ? ", r.icon" : "";
  const parentColumns = (type === "countries" ? ", r.continent_id, parent_br.name AS parent_name"
    : type === "locations" ? ", r.country_id, parent_br.name AS parent_name"
      : type === "points-of-interest" ? ", r.location_id, r.country_id, r.parent_poi_id, parent_br.name AS parent_name"
        : type === "deities" ? ", r.image_url, r.image_updated_at, r.rank, r.dm_notes"
          : type === "organizations" ? ", r.leader_mortal_id, leader_br.name AS leader_name" : "") + iconColumn;
  const parentJoin = type === "countries" ? "LEFT JOIN binder_records parent_br ON parent_br.id = r.continent_id"
    : type === "locations" ? "LEFT JOIN binder_records parent_br ON parent_br.id = r.country_id"
      : type === "points-of-interest" ? "LEFT JOIN binder_records parent_br ON parent_br.id = COALESCE(r.location_id, r.country_id, r.parent_poi_id)"
        : type === "organizations" ? "LEFT JOIN binder_records leader_br ON leader_br.id = r.leader_mortal_id" : "";
  return `SELECT r.id, br.binder_id, br.name, r.description, br.visibility,
    br.created_at, br.updated_at, ${entry.usageSql} AS usage_count ${parentColumns}
    FROM ${entry.table} r JOIN binder_records br ON br.id = r.id ${parentJoin}`;
}

export function resolveReferenceParent(db: Db, binderId: string, type: ReferenceType, value: string | null | undefined, recordId?: string): ResolvedParent {
  if (type === "continents" || !value) return null;
  const allowed: Record<ReferenceType, RecordType[]> = {
    races: [], positions: [], domains: [], organizations: [], deities: [], continents: [],
    countries: ["continent"], locations: ["country"], "points-of-interest": ["location", "country", "poi"],
  };
  if (value === recordId) throw Object.assign(new Error("A Point of Interest cannot contain itself"), { status: 400 });
  const parent = db.prepare("SELECT id, record_type FROM binder_records WHERE id = ? AND binder_id = ?")
    .get(value, binderId) as Exclude<ResolvedParent, null> | undefined;
  if (!parent || !allowed[type].includes(parent.record_type)) {
    throw Object.assign(new Error("Parent must be an allowed record from this Binder"), { status: 400 });
  }
  return parent;
}

export function resolveOrganizationLeader(db: Db, binderId: string, value: string | null | undefined): string | null {
  if (!value) return null;
  const mortal = db.prepare("SELECT m.id FROM mortals m JOIN binder_records br ON br.id=m.id WHERE m.id=? AND br.binder_id=?")
    .get(value, binderId) as { id: string } | undefined;
  if (!mortal) throw Object.assign(new Error("Leader must be a Mortal from this Binder"), { status: 400 });
  return mortal.id;
}

export function insertReferenceRecord(db: Db, table: ReferenceTable, type: ReferenceType, id: string, description: string | null, parent: ResolvedParent, t: number, leaderId?: string | null, icon?: string | null, rank?: string | null, dmNotes?: string | null) {
  if (type === "deities") db.prepare("INSERT INTO deities (id,description,dm_notes,rank,created_at,updated_at) VALUES (?,?,?,?,?,?)").run(id, description, dmNotes ?? null, rank ?? null, t, t);
  else if (type === "countries") db.prepare("INSERT INTO binder_countries (id,continent_id,description,created_at,updated_at) VALUES (?,?,?,?,?)").run(id, parent?.id ?? null, description, t, t);
  else if (type === "locations") db.prepare("INSERT INTO binder_locations (id,country_id,description,created_at,updated_at) VALUES (?,?,?,?,?)").run(id, parent?.id ?? null, description, t, t);
  else if (type === "points-of-interest") db.prepare("INSERT INTO binder_points_of_interest (id,location_id,country_id,parent_poi_id,description,created_at,updated_at,icon) VALUES (?,?,?,?,?,?,?,?)").run(id, parent?.record_type === "location" ? parent.id : null, parent?.record_type === "country" ? parent.id : null, parent?.record_type === "poi" ? parent.id : null, description, t, t, icon ?? null);
  else if (type === "organizations") db.prepare("INSERT INTO binder_organizations (id,description,leader_mortal_id,created_at,updated_at,icon) VALUES (?,?,?,?,?,?)").run(id, description, leaderId ?? null, t, t, icon ?? null);
  else if (type === "positions") db.prepare("INSERT INTO binder_positions (id,description,created_at,updated_at,icon) VALUES (?,?,?,?,?)").run(id, description, t, t, icon ?? null);
  else db.prepare(`INSERT INTO ${table} (id,description,created_at,updated_at) VALUES (?,?,?,?)`).run(id, description, t, t);
}

export function updateReferenceParent(db: Db, type: ReferenceType, id: string, parent: ResolvedParent) {
  if (type === "countries") db.prepare("UPDATE binder_countries SET continent_id=? WHERE id=?").run(parent?.id ?? null, id);
  if (type === "locations") db.prepare("UPDATE binder_locations SET country_id=? WHERE id=?").run(parent?.id ?? null, id);
  if (type === "points-of-interest") db.prepare("UPDATE binder_points_of_interest SET location_id=?,country_id=?,parent_poi_id=? WHERE id=?").run(parent?.record_type === "location" ? parent.id : null, parent?.record_type === "country" ? parent.id : null, parent?.record_type === "poi" ? parent.id : null, id);
}

export function updateOrganizationLeader(db: Db, id: string, leaderId: string | null) {
  db.prepare("UPDATE binder_organizations SET leader_mortal_id=? WHERE id=?").run(leaderId, id);
}
export function updateReferenceIcon(db: Db, table: ReferenceTable, id: string, icon: string | null) {
  db.prepare(`UPDATE ${table} SET icon=? WHERE id=?`).run(icon, id);
}
