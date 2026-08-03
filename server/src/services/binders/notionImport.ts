import { createHash } from "node:crypto";
import type { Db } from "../../lib/db.js";
import { unzipSync } from "fflate";
import { parse } from "csv-parse/sync";
import { normalizeKey } from "../../lib/text.js";
import { uid } from "../../lib/runtime.js";

type Row = Record<string, string>;
type Kind = "race" | "position" | "domain" | "continent" | "country" | "location" | "poi" | "organization" | "deity" | "mortal" | "item" | "event";
type Candidate = {
  kind: Kind;
  externalId: string;
  name: string;
  row: Row;
  markdown: string | null;
  subtype?: "npc" | "player_character";
};

export type NotionImportSummary = {
  fingerprint: string;
  databases: Array<{ name: string; rows: number }>;
  records: Partial<Record<Kind, number>>;
  ignored: Array<{ database: string; rows: number; reason: string }>;
  warnings: string[];
  unresolved: Array<{ source: string; field: string; value: string }>;
  detectedCurrentDate: number | null;
  alreadyImported: boolean;
  committed: boolean;
};

const DATABASES: Array<{ match: RegExp; name: string; kind?: Kind; nameColumn?: string; subtype?: Candidate["subtype"]; ignore?: string }> = [
  { match: /^Races .+_all\.csv$/i, name: "Races", kind: "race", nameColumn: "Race Name" },
  { match: /^Positions .+_all\.csv$/i, name: "Positions", kind: "position", nameColumn: "Position Name" },
  { match: /^Domains .+_all\.csv$/i, name: "Domains", kind: "domain", nameColumn: "Position Name" },
  { match: /^Continent .+_all\.csv$/i, name: "Continents", kind: "continent", nameColumn: "Continent" },
  { match: /^Country .+_all\.csv$/i, name: "Countries", kind: "country", nameColumn: "Country Name" },
  { match: /^Cities .+_all\.csv$/i, name: "Locations", kind: "location", nameColumn: "City Name" },
  { match: /^Places of Interests .+_all\.csv$/i, name: "Points of Interest", kind: "poi", nameColumn: "POI" },
  { match: /^Organization .+_all\.csv$/i, name: "Organizations", kind: "organization", nameColumn: "Org Name" },
  { match: /^Dieties .+_all\.csv$/i, name: "Deities", kind: "deity", nameColumn: "Name" },
  { match: /^Mortals .+_all\.csv$/i, name: "Mortals", kind: "mortal", nameColumn: "Name", subtype: "npc" },
  { match: /^Player Characters .+_all\.csv$/i, name: "Player Characters", kind: "mortal", nameColumn: "Name", subtype: "player_character" },
  { match: /^Timeline .+_all\.csv$/i, name: "Events", kind: "event", nameColumn: "Event" },
  { match: /^Items .+_all\.csv$/i, name: "Items", kind: "item", nameColumn: "Name" },
  { match: /^Loot Table .+_all\.csv$/i, name: "Loot Table", ignore: "Explicitly excluded as legacy data." },
  { match: /^HOME .+_all\.csv$/i, name: "HOME", ignore: "Not Binder lore data." },
  { match: /^People .+_all\.csv$/i, name: "Workspace People", ignore: "Not Binder lore data." },
  { match: /^Global Variables .+_all\.csv$/i, name: "Global Variables", ignore: "Used only to detect the setting current date." },
];
const RELATION_TARGETS: Record<string, Kind[]> = {
  Country: ["country"],
  Organization: ["organization"],
  Position: ["position"],
  Race: ["race"],
  Races: ["race"],
  Location: ["continent", "country", "location", "poi"],
  Domains: ["domain"],
  Leader: ["mortal"],
  Continent: ["continent"],
};

const text = (bytes: Uint8Array) => new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
const basename = (path: string) => path.split("/").pop() ?? path;
const notionIdFromUrl = (value: string) => value.match(/notion\.so\/([0-9a-f]{32})/i)?.[1]?.toLowerCase() ?? null;
const trailingId = (value: string) => value.match(/\s([0-9a-f]{32})\.md$/i)?.[1]?.toLowerCase() ?? null;
const relationIds = (value: string | undefined) => Array.from(value?.matchAll(/notion\.so\/([0-9a-f]{32})/gi) ?? []).map((match) => match[1]!.toLowerCase());
const numericDate = (value: string | undefined): number | null => {
  const cleaned = String(value ?? "").replaceAll(",", "").trim();
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
};

function csvRows(value: string): Row[] {
  return parse(value, { columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, trim: true }) as Row[];
}

function pageName(path: string): string {
  return basename(path).replace(/\s[0-9a-f]{32}\.md$/i, "").trim();
}

export function inspectNotionZip(buffer: Buffer, db?: Db, binderId?: string): { summary: NotionImportSummary; candidates: Candidate[] } {
  const fingerprint = createHash("sha256").update(buffer).digest("hex");
  const files = unzipSync(new Uint8Array(buffer));
  const markdownById = new Map<string, string>();
  const pageIdsByName = new Map<string, string[]>();
  for (const [path, bytes] of Object.entries(files)) {
    const id = trailingId(path);
    if (!id) continue;
    markdownById.set(id, text(bytes));
    const key = normalizeKey(pageName(path));
    pageIdsByName.set(key, [...(pageIdsByName.get(key) ?? []), id]);
  }
  const referencedByKind = new Map<Kind, Set<string>>();
  for (const [path, bytes] of Object.entries(files)) {
    if (!basename(path).endsWith("_all.csv")) continue;
    for (const row of csvRows(text(bytes))) {
      for (const [field, kinds] of Object.entries(RELATION_TARGETS)) {
        for (const externalId of relationIds(row[field])) {
          for (const kind of kinds) {
            const ids = referencedByKind.get(kind) ?? new Set<string>();
            ids.add(externalId);
            referencedByKind.set(kind, ids);
          }
        }
      }
    }
  }

  const candidates: Candidate[] = [];
  const databases: NotionImportSummary["databases"] = [];
  const ignored: NotionImportSummary["ignored"] = [];
  const warnings: string[] = [];
  let detectedCurrentDate: number | null = null;
  for (const [path, bytes] of Object.entries(files)) {
    const file = basename(path);
    if (!file.endsWith("_all.csv")) continue;
    const spec = DATABASES.find((entry) => entry.match.test(file));
    if (!spec) {
      const rows = csvRows(text(bytes));
      ignored.push({ database: file, rows: rows.length, reason: "Unsupported database; no data was silently discarded." });
      continue;
    }
    const rows = csvRows(text(bytes));
    databases.push({ name: spec.name, rows: rows.length });
    if (spec.name === "Global Variables") {
      detectedCurrentDate = numericDate(rows.find((row) => normalizeKey(row.Name) === "const")?.currDate);
    }
    if (spec.ignore) {
      ignored.push({ database: spec.name, rows: rows.length, reason: spec.ignore });
      continue;
    }
    rows.forEach((row, index) => {
      const name = row[spec.nameColumn!] || `Untitled ${spec.name} ${index + 1}`;
      if (normalizeKey(name) === "none") {
        warnings.push(`${spec.name}: skipped placeholder row named "None".`);
        return;
      }
      const ids = pageIdsByName.get(normalizeKey(name)) ?? [];
      const typeMatches = ids.filter((id) => referencedByKind.get(spec.kind!)?.has(id));
      const resolvedIds = typeMatches.length === 1 ? typeMatches : ids;
      if (resolvedIds.length > 1) warnings.push(`${spec.name}: "${name}" matches ${ids.length} Markdown pages; using a deterministic CSV identity.`);
      const externalId = resolvedIds.length === 1 ? resolvedIds[0]! : `csv:${normalizeKey(spec.name)}:${index + 1}`;
      candidates.push({
        kind: spec.kind!,
        externalId,
        name,
        row,
        markdown: resolvedIds.length === 1 ? markdownById.get(resolvedIds[0]!) ?? null : null,
        ...(spec.subtype ? { subtype: spec.subtype } : {}),
      });
    });
  }
  const records: NotionImportSummary["records"] = {};
  for (const candidate of candidates) records[candidate.kind] = (records[candidate.kind] ?? 0) + 1;
  const candidateExternalIds = new Set(candidates.map((candidate) => candidate.externalId));
  const unresolved: NotionImportSummary["unresolved"] = [];
  const unresolvedKeys = new Set<string>();
  for (const candidate of candidates) {
    for (const [field, value] of Object.entries(candidate.row)) {
      if (!RELATION_TARGETS[field]) continue;
      for (const externalId of relationIds(value)) {
        if (candidateExternalIds.has(externalId)) continue;
        const key = `${candidate.externalId}:${field}:${externalId}`;
        if (unresolvedKeys.has(key)) continue;
        unresolvedKeys.add(key);
        unresolved.push({ source: candidate.name, field, value: externalId });
      }
    }
  }
  const alreadyImported = Boolean(db && binderId && db.prepare(`
    SELECT 1 FROM binder_import_runs
    WHERE binder_id = ? AND source = 'notion_zip' AND source_fingerprint = ? AND status = 'completed'
  `).get(binderId, fingerprint));
  return {
    candidates,
    summary: { fingerprint, databases, records, ignored, warnings, unresolved, detectedCurrentDate, alreadyImported, committed: false },
  };
}

function description(candidate: Candidate): string | null {
  const lines = candidate.markdown?.replace(/\r/g, "").split("\n") ?? [];
  if (lines[0]?.trim().replace(/^#+\s*/, "") === candidate.name.trim()) lines.shift();
  const propertyNames = new Set([
    "location", "position", "organization", "race", "races", "doa", "age",
    "continent", "currdate", "dob", "dod", "gender", "global variables",
  ]);
  while (lines.length) {
    const line = lines[0]!.trim();
    if (!line) {
      lines.shift();
      continue;
    }
    const property = line.match(/^([^:]+):/)?.[1]?.trim().toLocaleLowerCase();
    if (!property || !propertyNames.has(property)) break;
    lines.shift();
  }
  const value = lines.join("\n").trim();
  return value || null;
}

export function importNotionZip(db: Db, binderId: string, buffer: Buffer, commit: boolean): NotionImportSummary {
  const binder = db.prepare("SELECT 1 FROM binders WHERE id = ?").get(binderId);
  if (!binder) throw new Error(`Binder not found: ${binderId}`);
  const inspected = inspectNotionZip(buffer, db, binderId);
  const summary = inspected.summary;
  if (!commit || summary.alreadyImported) return summary;

  const now = Date.now();
  const runId = uid();
  const idByExternal = new Map<string, string>();
  for (const candidate of inspected.candidates) idByExternal.set(candidate.externalId, uid());
  const kindByExternal = new Map(inspected.candidates.map((candidate) => [candidate.externalId, candidate.kind]));
  const candidatesByKind = (kind: Kind) => inspected.candidates.filter((candidate) => candidate.kind === kind);
  const resolve = (candidate: Candidate, field: string): string | null => {
    const raw = candidate.row[field] ?? "";
    const externalId = notionIdFromUrl(raw);
    if (!raw) return null;
    if (!externalId || !idByExternal.has(externalId)) {
      return null;
    }
    return idByExternal.get(externalId)!;
  };
  const insertRecord = db.prepare(`
    INSERT INTO binder_records (id, binder_id, record_type, name, name_key, visibility, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertExternal = db.prepare(`
    INSERT INTO binder_external_ids (id, binder_id, source, external_type, external_id, record_id, import_run_id)
    VALUES (?, ?, 'notion', ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare(`
      INSERT INTO binder_import_runs
        (id, binder_id, source, source_fingerprint, status, dry_run, started_by_user_id, summary_json, created_at, updated_at)
      VALUES (?, ?, 'notion_zip', ?, 'importing', 0, NULL, '{}', ?, ?)
    `).run(runId, binderId, summary.fingerprint, now, now);

    for (const candidate of inspected.candidates) {
      const id = idByExternal.get(candidate.externalId)!;
      const visibility = ["continent", "country", "location"].includes(candidate.kind) ? "public" : "dm";
      insertRecord.run(id, binderId, candidate.kind, candidate.name, normalizeKey(candidate.name), visibility, now, now);
      insertExternal.run(uid(), binderId, candidate.kind, candidate.externalId, id, runId);
    }
    const simple: Array<[Kind, string]> = [["race", "binder_races"], ["position", "binder_positions"], ["domain", "binder_domains"], ["continent", "binder_continents"]];
    for (const [kind, table] of simple) {
      const statement = db.prepare(`INSERT INTO ${table} (id, description, created_at, updated_at) VALUES (?, ?, ?, ?)`);
      for (const candidate of candidatesByKind(kind)) statement.run(idByExternal.get(candidate.externalId), description(candidate), now, now);
    }
    for (const candidate of candidatesByKind("country")) db.prepare(`
      INSERT INTO binder_countries (id, continent_id, description, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)
    `).run(idByExternal.get(candidate.externalId), description(candidate), now, now);
    for (const continent of candidatesByKind("continent")) {
      for (const countryExternalId of relationIds(continent.row.Country)) {
        const countryId = idByExternal.get(countryExternalId);
        if (countryId) db.prepare("UPDATE binder_countries SET continent_id = ? WHERE id = ?").run(idByExternal.get(continent.externalId), countryId);
        else summary.unresolved.push({ source: continent.name, field: "Country", value: countryExternalId });
      }
    }
    for (const candidate of candidatesByKind("location")) {
      const countryId = resolve(candidate, "Country");
      const continentId = resolve(candidate, "Continent");
      db.prepare(`
        INSERT INTO binder_locations (id, country_id, continent_id, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(idByExternal.get(candidate.externalId), countryId, continentId, description(candidate), now, now);
      if (countryId && continentId) {
        const country = db.prepare("SELECT continent_id FROM binder_countries WHERE id = ?").get(countryId) as { continent_id: string | null };
        if (!country.continent_id) {
          db.prepare("UPDATE binder_countries SET continent_id = ? WHERE id = ?").run(continentId, countryId);
        } else if (country.continent_id !== continentId) {
          summary.unresolved.push({
            source: candidate.name,
            field: "Continent",
            value: `Country is associated with conflicting Continents (${country.continent_id}, ${continentId})`,
          });
        }
      }
    }
    for (const candidate of candidatesByKind("poi")) db.prepare(`
      INSERT INTO binder_points_of_interest (id, location_id, country_id, parent_poi_id, description, created_at, updated_at)
      VALUES (?, NULL, NULL, NULL, ?, ?, ?)
    `).run(idByExternal.get(candidate.externalId), description(candidate), now, now);
    for (const candidate of candidatesByKind("mortal")) {
      const id = idByExternal.get(candidate.externalId)!;
      const raceId = resolve(candidate, candidate.subtype === "player_character" ? "Races" : "Race");
      const locationExternalId = notionIdFromUrl(candidate.row.Location ?? "");
      const locationId = locationExternalId && ["location", "poi"].includes(kindByExternal.get(locationExternalId) ?? "")
        ? resolve(candidate, "Location")
        : null;
      const birth = numericDate(candidate.row.DoB);
      const death = numericDate(candidate.row.DoD);
      const gender = normalizeKey(candidate.row.Gender);
      db.prepare(`
        INSERT INTO mortals (
          id, race_id, gender, life_status, birth_date_text, birth_date_sort, death_date_text,
          death_date_sort, description, backstory, dm_notes, residence_record_id, position_id,
          mortal_type, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
      `).run(id, raceId, gender === "male" || gender === "female" ? gender : null, death === null ? "alive" : "dead",
        candidate.row.DoB || null, birth, candidate.row.DoD || null, death, description(candidate), locationId,
        resolve(candidate, "Position"), candidate.subtype, now, now);
      if (candidate.subtype === "player_character") {
        db.prepare("INSERT INTO binder_player_characters (mortal_id, character_id, player_id, created_at, updated_at) VALUES (?, NULL, NULL, ?, ?)").run(id, now, now);
      } else {
        db.prepare("INSERT INTO binder_npcs (mortal_id, monster_id, created_at, updated_at) VALUES (?, NULL, ?, ?)").run(id, now, now);
      }
    }
    for (const candidate of candidatesByKind("organization")) db.prepare(`
      INSERT INTO binder_organizations (id, description, dm_notes, leader_mortal_id, headquarters_record_id, created_at, updated_at)
      VALUES (?, ?, NULL, ?, NULL, ?, ?)
    `).run(idByExternal.get(candidate.externalId), description(candidate), resolve(candidate, "Leader"), now, now);
    for (const candidate of candidatesByKind("mortal")) {
      const organizationIds = relationIds(candidate.row.Organization)
        .map((externalId) => idByExternal.get(externalId))
        .filter((id): id is string => Boolean(id));
      organizationIds.forEach((organizationId, index) => db.prepare(`
          INSERT INTO organization_memberships
            (id, organization_id, mortal_id, is_primary, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          uid(),
          organizationId,
          idByExternal.get(candidate.externalId),
          index === 0 ? 1 : 0,
          now,
          now,
        ));
    }
    for (const candidate of candidatesByKind("deity")) {
      const id = idByExternal.get(candidate.externalId)!;
      db.prepare(`
        INSERT INTO deities (id, rank, description, dm_notes, primary_location_record_id, created_at, updated_at)
        VALUES (?, ?, ?, NULL, ?, ?, ?)
      `).run(id, candidate.row.Rank || null, description(candidate), resolve(candidate, "Location"), now, now);
      for (const externalId of relationIds(candidate.row.Domains)) {
        const domainId = idByExternal.get(externalId);
        if (domainId) db.prepare("INSERT OR IGNORE INTO deity_domains (deity_id, domain_id) VALUES (?, ?)").run(id, domainId);
        else summary.unresolved.push({ source: candidate.name, field: "Domains", value: externalId });
      }
    }
    for (const candidate of candidatesByKind("item")) {
      const id = idByExternal.get(candidate.externalId)!;
      const compendium = db.prepare("SELECT id FROM compendium_items WHERE name_key = ? ORDER BY ruleset DESC LIMIT 1")
        .get(normalizeKey(candidate.name)) as { id: string } | undefined;
      db.prepare(`
        INSERT INTO binder_items (
          id, description, dm_notes, compendium_item_id, holder_mortal_id,
          location_record_id, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, NULL, NULL, ?, ?)
      `).run(id, description(candidate), compendium?.id ?? null, now, now);
    }
    for (const candidate of candidatesByKind("event")) {
      const id = idByExternal.get(candidate.externalId)!;
      db.prepare(`
        INSERT INTO binder_events (id, description, date_text, date_sort, end_date_text, end_date_sort, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
      `).run(id, description(candidate), candidate.row.Date || null, numericDate(candidate.row.Date), now, now);
      const continentId = resolve(candidate, "Continent");
      if (continentId) db.prepare(`
        INSERT INTO binder_event_records (id, event_id, record_id, role, description, sort) VALUES (?, ?, ?, 'location', NULL, 0)
      `).run(uid(), id, continentId);
      if (candidate.row.Type) {
        const key = normalizeKey(candidate.row.Type);
        let tag = db.prepare("SELECT id FROM binder_event_tags WHERE binder_id = ? AND name_key = ?").get(binderId, key) as { id: string } | undefined;
        if (!tag) {
          tag = { id: uid() };
          db.prepare("INSERT INTO binder_event_tags (id, binder_id, name, name_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(tag.id, binderId, candidate.row.Type, key, now, now);
        }
        db.prepare("INSERT OR IGNORE INTO binder_event_tag_links (event_id, tag_id) VALUES (?, ?)").run(id, tag.id);
      }
    }
    if (summary.detectedCurrentDate !== null) db.prepare(`
      UPDATE binders SET current_date_text = ?, current_date_sort = ?, updated_at = ? WHERE id = ?
    `).run(String(summary.detectedCurrentDate), summary.detectedCurrentDate, now, binderId);
    summary.committed = true;
    db.prepare("UPDATE binder_import_runs SET status = 'completed', summary_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(summary), now, runId);
  })();
  return summary;
}
