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
  "binder_event_tag_links", "binder_event_records", "binder_event_campaigns", "binder_items",
  "binder_relationships", "binder_record_mentions",
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
  binder_event_campaigns: "event_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_items: "id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
  binder_relationships: "binder_id = ?",
  binder_record_mentions: "source_record_id IN (SELECT id FROM binder_records WHERE binder_id = ?)",
};

// MARK: - Export Binder Document
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

// MARK: - Preview Binder Document
export function previewBinderDocument(db: Db, raw: unknown) {
  const doc = NativeBinderDocument.parse(raw);
  const counts = new Map<string, number>();
  for (const record of doc.records) {
    const type = String(record.record_type);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const npcRows = doc.data.binder_npcs ?? [];
  const itemRows = doc.data.binder_items ?? [];
  const eventCampaignRows = doc.data.binder_event_campaigns ?? [];
  const missingMonsterLinks = npcRows.filter((row) => row.monster_id && !db.prepare("SELECT 1 FROM compendium_monsters WHERE id=?").get(row.monster_id)).length;
  const missingItemLinks = itemRows.filter((row) => row.compendium_item_id && !db.prepare("SELECT 1 FROM compendium_items WHERE id=?").get(row.compendium_item_id)).length;
  return {
    name: doc.binder.name,
    recordCount: doc.records.length,
    counts: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({ type, count })),
    associations: {
      relationships: (doc.data.binder_relationships ?? []).length,
      mentions: (doc.data.binder_record_mentions ?? []).length,
      memberships: (doc.data.organization_memberships ?? []).length,
      eventRecords: (doc.data.binder_event_records ?? []).length,
    },
    warnings: [
      ...(missingMonsterLinks ? [`${missingMonsterLinks} Compendium monster link(s) are unavailable and will be detached.`] : []),
      ...(missingItemLinks ? [`${missingItemLinks} Compendium item link(s) are unavailable and will be detached.`] : []),
      ...(eventCampaignRows.length ? [`${eventCampaignRows.length} Campaign association(s) are instance-local and will be detached.`] : []),
    ],
  };
}

// MARK: - Import Binder Document
export function importBinderDocument(db: Db, raw: unknown, ownerUserId: string, helpers: Helpers) {
  const doc = NativeBinderDocument.parse(raw);
  const idMap = new Map<string, string>();
  for (const record of doc.records) idMap.set(String(record.id), helpers.uid());
  const tagMap = new Map<string, string>();
  for (const tag of doc.data.binder_event_tags ?? []) tagMap.set(String(tag.id), helpers.uid());
  const map = (value: unknown) => value == null ? null : idMap.get(String(value)) ?? null;
  const mortalResidenceIds = new Set(doc.records
    .filter((record) => record.record_type === "location" || record.record_type === "poi")
    .map((record) => String(record.id)));
  const mapMortalResidence = (value: unknown) => value != null && mortalResidenceIds.has(String(value))
    ? map(value)
    : null;
  const tag = (value: unknown) => value == null ? null : tagMap.get(String(value)) ?? null;
  const now = helpers.now();
  const binderId = helpers.uid();
  const importedRecordIds = new Set(idMap.values());
  const text = (value: unknown) => {
    if (value == null) return null;
    let result = String(value);
    for (const [oldId, newId] of idMap) {
      const escapedId = oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`(?<![A-Za-z0-9-])${escapedId}(?![A-Za-z0-9-])`, "g"), newId);
    }
    // Native exports can contain links written while records lived in an older
    // Binder (or even several older Binders after earlier imports). The target
    // record is the stable part. Once it has been remapped, point its route at
    // the Binder being created now.
    result = result.replace(
      /\/binder\/[^/]+\/([^/]+)\/([^/?#)]+)/g,
      (whole, section: string, recordId: string) => importedRecordIds.has(decodeURIComponent(recordId))
        ? `/binder/${binderId}/${section}/${recordId}`
        : whole,
    );
    return result;
  };
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
      ["binder_positions", "id, description, created_at, updated_at, icon"],
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
    for (const row of rows("binder_countries")) db.prepare(`
      INSERT INTO binder_countries (id, continent_id, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(map(row.id), map(row.continent_id), text(row.description), now, now);
    for (const row of rows("binder_locations")) db.prepare(`
      INSERT INTO binder_locations (id, country_id, continent_id, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(map(row.id), map(row.country_id), map(row.continent_id), text(row.description), now, now);
    for (const row of rows("binder_points_of_interest")) db.prepare("INSERT INTO binder_points_of_interest (id, location_id, country_id, parent_poi_id, description, created_at, updated_at, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(map(row.id), map(row.location_id), map(row.country_id), map(row.parent_poi_id), text(row.description), now, now, row.icon ?? null);
    for (const row of rows("mortals")) db.prepare(`
      INSERT INTO mortals (id,race_id,gender,life_status,birth_date_text,birth_date_sort,death_date_text,death_date_sort,description,backstory,dm_notes,image_url,image_updated_at,residence_record_id,position_id,class_name,mortal_type,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(map(row.id), map(row.race_id), row.gender ?? null, row.life_status ?? (row.death_date_text ? "dead" : "alive"), row.birth_date_text ?? null, row.birth_date_sort ?? null, row.death_date_text ?? null, row.death_date_sort ?? null, text(row.description), text(row.backstory), text(row.dm_notes), null, null, mapMortalResidence(row.residence_record_id), map(row.position_id), text(row.class_name), row.mortal_type, now, now);
    for (const row of rows("binder_npcs")) db.prepare(`
      INSERT INTO binder_npcs (
        mortal_id, monster_id, hp_max, hp_current, hp_details, ac, ac_details,
        attack_overrides_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      map(row.mortal_id),
      row.monster_id && db.prepare("SELECT 1 FROM compendium_monsters WHERE id=?").get(row.monster_id)
        ? row.monster_id : null,
      row.hp_max ?? null, row.hp_current ?? null,
      text(row.hp_details), row.ac ?? null, text(row.ac_details),
      row.attack_overrides_json == null ? null : String(row.attack_overrides_json), now, now,
    );
    // Characters and Campaign player rows are installation-local. Preserve the Mortal as a
    // normal unlinked PC and let the user explicitly relink it in the destination installation.
    for (const row of rows("binder_player_characters")) db.prepare(`
      INSERT INTO binder_player_characters (mortal_id, character_id, player_id, created_at, updated_at)
      VALUES (?, NULL, NULL, ?, ?)
    `).run(map(row.mortal_id), now, now);
    for (const row of rows("deities")) db.prepare(`
      INSERT INTO deities (id, rank, description, dm_notes, image_url, image_updated_at, primary_location_record_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(map(row.id), row.rank ?? null, text(row.description), text(row.dm_notes), null, null, map(row.primary_location_record_id), now, now);
    for (const row of rows("deity_domains")) db.prepare("INSERT INTO deity_domains VALUES (?, ?)").run(map(row.deity_id), map(row.domain_id));
    for (const row of rows("binder_organizations")) db.prepare("INSERT INTO binder_organizations (id, description, dm_notes, leader_mortal_id, headquarters_record_id, created_at, updated_at, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(map(row.id), text(row.description), text(row.dm_notes), map(row.leader_mortal_id), map(row.headquarters_record_id), now, now, row.icon ?? null);
    for (const row of rows("organization_memberships")) db.prepare(`
      INSERT INTO organization_memberships (id,organization_id,mortal_id,role_label,start_date_text,start_date_sort,end_date_text,end_date_sort,notes,is_primary,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(helpers.uid(), map(row.organization_id), map(row.mortal_id), row.role_label ?? null, row.start_date_text ?? null, row.start_date_sort ?? null, row.end_date_text ?? null, row.end_date_sort ?? null, text(row.notes), row.is_primary ?? 0, now, now);
    for (const row of rows("binder_record_aliases")) db.prepare("INSERT INTO binder_record_aliases VALUES (?, ?, ?, ?, ?)").run(helpers.uid(), map(row.record_id), row.alias, row.alias_key, row.sort ?? 0);
    for (const row of rows("binder_event_tags")) db.prepare("INSERT INTO binder_event_tags VALUES (?, ?, ?, ?, ?, ?)").run(tag(row.id), binderId, row.name, helpers.normalizeKey(String(row.name)), now, now);
    for (const row of rows("binder_event_tag_links")) db.prepare("INSERT INTO binder_event_tag_links VALUES (?, ?)").run(map(row.event_id), tag(row.tag_id));
    for (const row of rows("binder_event_records")) db.prepare("INSERT INTO binder_event_records VALUES (?, ?, ?, ?, ?, ?)").run(helpers.uid(), map(row.event_id), map(row.record_id), row.role ?? null, text(row.description), row.sort ?? 0);
    // Campaigns are instance-local. Associations without a matching campaign
    // are intentionally left detached, matching Binder import semantics.
    for (const row of rows("binder_event_campaigns")) {
      const campaign = db.prepare("SELECT id FROM campaigns WHERE id = ? AND binder_id = ?").get(row.campaign_id, binderId);
      if (campaign) db.prepare("INSERT INTO binder_event_campaigns VALUES (?, ?, ?, ?, ?)").run(helpers.uid(), map(row.event_id), row.campaign_id, row.role ?? null, text(row.description));
    }
    for (const row of rows("binder_items")) db.prepare(`
      INSERT INTO binder_items (
        id,description,dm_notes,compendium_item_id,holder_mortal_id,location_record_id,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).run(
      map(row.id), text(row.description), text(row.dm_notes),
      row.compendium_item_id && db.prepare("SELECT 1 FROM compendium_items WHERE id=?").get(row.compendium_item_id)
        ? row.compendium_item_id : null,
      map(row.holder_mortal_id), map(row.location_record_id), now, now,
    );
    for (const row of rows("binder_relationships")) db.prepare(`
      INSERT INTO binder_relationships (
        id,binder_id,source_record_id,target_record_id,category,source_label,target_label,is_symmetric,
        start_date_text,start_date_sort,end_date_text,end_date_sort,notes,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      helpers.uid(), binderId, map(row.source_record_id), map(row.target_record_id), row.category,
      row.source_label ?? null, row.target_label ?? null, row.is_symmetric ?? 0,
      row.start_date_text ?? null, row.start_date_sort ?? null, row.end_date_text ?? null,
      row.end_date_sort ?? null, text(row.notes), now, now,
    );
    for (const row of rows("binder_record_mentions")) db.prepare(`
      INSERT INTO binder_record_mentions (id,source_record_id,source_field,target_record_id,target_external_id,label,occurrence_key,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(helpers.uid(), map(row.source_record_id), row.source_field, map(row.target_record_id), row.target_external_id ?? null, row.label, text(row.occurrence_key), now);
  })();
  return { binderId, name: doc.binder.name, recordCount: doc.records.length, recordIdMap: Object.fromEntries(idMap) };
}
