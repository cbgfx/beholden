import { z } from "zod";
import type { Db } from "../../lib/db.js";

const Row = z.record(z.string(), z.unknown());
const NativeBinderDocument = z.object({
  format: z.literal("beholden-binder"),
  version: z.literal(1),
  binder: z.object({
    name: z.string().min(1).max(160),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    description: z.string().nullable(),
    currentDateText: z.string().nullable(),
    currentDateSort: z.number().int().nullable(),
  }),
  records: z.array(Row).max(100_000),
  data: z.record(z.string(), z.array(Row).max(100_000)),
}).strict();

const TABLES = [
  "binder_record_aliases", "binder_races", "binder_positions", "binder_domains",
  "binder_continents", "binder_countries", "binder_locations", "binder_points_of_interest",
  "mortals", "binder_npcs", "binder_player_characters", "deities", "deity_domains",
  "binder_organizations", "organization_memberships", "binder_events", "binder_event_tags",
  "binder_event_tag_links", "binder_event_records", "binder_record_mentions",
] as const;

const TABLE_FILTER: Record<(typeof TABLES)[number], string> = {
  binder_record_aliases: "record_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_races: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_positions: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_domains: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_continents: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_countries: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_locations: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_points_of_interest: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  mortals: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_npcs: "mortal_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_player_characters: "mortal_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  deities: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  deity_domains: "deity_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_organizations: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  organization_memberships: "mortal_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_events: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_event_tags: "binder_id = ?",
  binder_event_tag_links: "event_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_event_records: "event_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_record_mentions: "source_record_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
};

export function exportBinderDocument(db: Db, binderId: string) {
  const binder = db.prepare(`
    SELECT name, color, description, current_date_text, current_date_sort
    FROM binders WHERE id = ?
  `).get(binderId) as any;
  if (!binder) return null;
  const records = db.prepare(`
    SELECT id, record_type, name, name_key, visibility, created_at, updated_at
    FROM binder_records WHERE binder_id = ? ORDER BY created_at, id
  `).all(binderId);
  const data = Object.fromEntries(TABLES.map((table) => [
    table,
    db.prepare(`SELECT * FROM ${table} WHERE ${TABLE_FILTER[table]}`).all(binderId),
  ]));
  return {
    format: "beholden-binder",
    version: 1,
    binder: {
      name: binder.name,
      color: binder.color,
      description: binder.description,
      currentDateText: binder.current_date_text,
      currentDateSort: binder.current_date_sort,
    },
    records,
    data,
  };
}

type Helpers = { uid: () => string; now: () => number; normalizeKey: (value: string) => string };

export function importBinderDocument(db: Db, raw: unknown, ownerUserId: string, helpers: Helpers) {
  const doc = NativeBinderDocument.parse(raw);
  const idMap = new Map<string, string>();
  for (const record of doc.records) idMap.set(String(record.id), helpers.uid());
  const tagMap = new Map<string, string>();
  for (const tag of doc.data.binder_event_tags ?? []) tagMap.set(String(tag.id), helpers.uid());
  const map = (value: unknown) => value == null ? null : idMap.get(String(value)) ?? null;
  const tag = (value: unknown) => value == null ? null : tagMap.get(String(value)) ?? null;
  const text = (value: unknown) => {
    if (value == null) return null;
    let result = String(value);
    for (const [oldId, newId] of idMap) result = result.replaceAll(oldId, newId);
    return result;
  };
  const now = helpers.now();
  const binderId = helpers.uid();
  const rows = (table: string) => doc.data[table] ?? [];

  db.transaction(() => {
    db.prepare(`
      INSERT INTO binders (id, owner_user_id, name, name_key, color, description, current_date_text, current_date_sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(binderId, ownerUserId, doc.binder.name, helpers.normalizeKey(doc.binder.name), doc.binder.color,
      doc.binder.description, doc.binder.currentDateText, doc.binder.currentDateSort, now, now);

    const insertRecord = db.prepare(`
      INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of doc.records) insertRecord.run(map(row.id), binderId, row.record_type, row.name,
      helpers.normalizeKey(String(row.name)), row.visibility ?? "dm", now, now);

    const simple = [
      ["binder_races", "id, description, created_at, updated_at"],
      ["binder_positions", "id, description, created_at, updated_at"],
      ["binder_domains", "id, description, created_at, updated_at"],
      ["binder_continents", "id, description, created_at, updated_at"],
      ["binder_events", "id, description, date_text, date_sort, end_date_text, end_date_sort, created_at, updated_at"],
    ] as const;
    for (const [table, columns] of simple) {
      const names = columns.split(", ");
      const statement = db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${names.map(() => "?").join(",")})`);
      for (const row of rows(table)) statement.run(...names.map((name) => {
        if (name === "id") return map(row.id);
        if (name === "created_at" || name === "updated_at") return now;
        if (name === "description") return text(row[name]);
        return row[name] ?? null;
      }));
    }
    for (const row of rows("binder_countries")) db.prepare("INSERT INTO binder_countries VALUES (?, ?, ?, ?, ?)").run(map(row.id), map(row.continent_id), text(row.description), now, now);
    for (const row of rows("binder_locations")) db.prepare(`
      INSERT INTO binder_locations (id, country_id, continent_id, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(map(row.id), map(row.country_id), map(row.continent_id), text(row.description), now, now);
    for (const row of rows("binder_points_of_interest")) db.prepare("INSERT INTO binder_points_of_interest VALUES (?, ?, ?, ?, ?, ?, ?)").run(map(row.id), map(row.location_id), map(row.country_id), map(row.parent_poi_id), text(row.description), now, now);
    for (const row of rows("mortals")) db.prepare(`
      INSERT INTO mortals (id,race_id,gender,life_status,birth_date_text,birth_date_sort,death_date_text,death_date_sort,description,backstory,dm_notes,image_url,image_updated_at,residence_record_id,position_id,mortal_type,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(map(row.id), map(row.race_id), row.gender ?? null, row.death_date_text ? "dead" : "alive", row.birth_date_text ?? null, row.birth_date_sort ?? null, row.death_date_text ?? null, row.death_date_sort ?? null, text(row.description), text(row.backstory), text(row.dm_notes), null, null, map(row.residence_record_id), map(row.position_id), row.mortal_type, now, now);
    for (const row of rows("binder_npcs")) db.prepare("INSERT INTO binder_npcs VALUES (?, NULL, ?, ?)").run(map(row.mortal_id), now, now);
    for (const row of rows("binder_player_characters")) db.prepare("INSERT INTO binder_player_characters VALUES (?, NULL, NULL, ?, ?)").run(map(row.mortal_id), now, now);
    for (const row of rows("deities")) db.prepare(`
      INSERT INTO deities (id, rank, description, dm_notes, image_url, image_updated_at, primary_location_record_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(map(row.id), row.rank ?? null, text(row.description), text(row.dm_notes), text(row.image_url), row.image_updated_at ?? null, map(row.primary_location_record_id), now, now);
    for (const row of rows("deity_domains")) db.prepare("INSERT INTO deity_domains VALUES (?, ?)").run(map(row.deity_id), map(row.domain_id));
    for (const row of rows("binder_organizations")) db.prepare("INSERT INTO binder_organizations VALUES (?, ?, ?, ?, ?, ?, ?)").run(map(row.id), text(row.description), text(row.dm_notes), map(row.leader_mortal_id), map(row.headquarters_record_id), now, now);
    for (const row of rows("organization_memberships")) db.prepare(`
      INSERT INTO organization_memberships (id,organization_id,mortal_id,position_id,role_label,start_date_text,start_date_sort,end_date_text,end_date_sort,notes,is_primary,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(helpers.uid(), map(row.organization_id), map(row.mortal_id), map(row.position_id), row.role_label ?? null, row.start_date_text ?? null, row.start_date_sort ?? null, row.end_date_text ?? null, row.end_date_sort ?? null, text(row.notes), row.is_primary ?? 0, now, now);
    for (const row of rows("binder_record_aliases")) db.prepare("INSERT INTO binder_record_aliases VALUES (?, ?, ?, ?, ?)").run(helpers.uid(), map(row.record_id), row.alias, row.alias_key, row.sort ?? 0);
    for (const row of rows("binder_event_tags")) db.prepare("INSERT INTO binder_event_tags VALUES (?, ?, ?, ?, ?, ?)").run(tag(row.id), binderId, row.name, helpers.normalizeKey(String(row.name)), now, now);
    for (const row of rows("binder_event_tag_links")) db.prepare("INSERT INTO binder_event_tag_links VALUES (?, ?)").run(map(row.event_id), tag(row.tag_id));
    for (const row of rows("binder_event_records")) db.prepare("INSERT INTO binder_event_records VALUES (?, ?, ?, ?, ?, ?)").run(helpers.uid(), map(row.event_id), map(row.record_id), row.role ?? null, text(row.description), row.sort ?? 0);
    for (const row of rows("binder_record_mentions")) db.prepare(`
      INSERT INTO binder_record_mentions (id,source_record_id,source_field,target_record_id,target_external_id,label,occurrence_key,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(helpers.uid(), map(row.source_record_id), row.source_field, map(row.target_record_id), row.target_external_id ?? null, row.label, row.occurrence_key, now);
  })();
  return { binderId, name: doc.binder.name, recordCount: doc.records.length };
}
