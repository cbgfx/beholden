import {
  collectBinderBacklinks,
  type BacklinkSource,
} from "@beholden/shared/domain/binderBacklinks";
import type { Db } from "../../lib/db.js";
import { canSeeDmContent } from "../../middleware/campaignAuth.js";

const RECORD_SOURCES = [
  ["mortals", "mortal", ["description", "dm_notes"]],
  ["deities", "deity", ["description", "dm_notes"]],
  ["binder_races", "race", ["description"]],
  ["binder_positions", "position", ["description"]],
  ["binder_domains", "domain", ["description"]],
  ["binder_organizations", "organization", ["description", "dm_notes"]],
  ["binder_continents", "continent", ["description"]],
  ["binder_countries", "country", ["description"]],
  ["binder_locations", "location", ["description"]],
  ["binder_points_of_interest", "poi", ["description"]],
  ["binder_items", "item", ["description", "dm_notes"]],
  ["binder_events", "event", ["description"]],
] as const;

/** Only fixed table/field names enter SQL. All user identifiers stay bound parameters.
 * The text predicate keeps old imports discoverable even when no mention index was populated. */
export function binderBacklinks(
  db: Db,
  binderId: string,
  targetId: string,
  routeFor: (type: string, binderId: string, id: string) => string,
  viewer: { userId: string; isAdmin: boolean },
) {
  const queries = RECORD_SOURCES.flatMap(([table, type, fields]) =>
    fields.map((field) => {
      const text =
        table === "mortals" && field === "description"
          ? "COALESCE(t.description,t.backstory)"
          : `t.${field}`;
      return `
    SELECT br.id,br.name,'${type}' type,'${field}' field,${text} text
    FROM ${table} t JOIN binder_records br ON br.id=t.id
    WHERE br.binder_id=? AND (instr(${text},?)>0 OR instr(${text},?)>0)
  `;
    }),
  );
  const params = queries.flatMap(() => [
    binderId,
    targetId,
    encodeURIComponent(targetId),
  ]);
  const rows = db.prepare(queries.join(" UNION ALL ")).all(...params) as Array<
    Omit<BacklinkSource, "route">
  >;
  const sources: BacklinkSource[] = rows.map((row) => ({
    ...row,
    route: routeFor(row.type, binderId, row.id),
  }));
  const campaigns = db
    .prepare(
      `SELECT id,name,campaign_story,campaign_notes FROM campaigns WHERE binder_id=? AND (instr(campaign_story,?)>0 OR instr(campaign_notes,?)>0)`,
    )
    .all(binderId, targetId, targetId) as Array<{
    id: string;
    name: string;
    campaign_story: string | null;
    campaign_notes: string | null;
  }>;
  for (const campaign of campaigns) {
    if (!canSeeDmContent(db, viewer, campaign.id)) continue;
    for (const field of ["campaign_story", "campaign_notes"] as const)
      sources.push({
        id: campaign.id,
        name: campaign.name,
        type: "campaign",
        route: `/binder/${binderId}/campaigns/${campaign.id}`,
        field,
        text: campaign[field],
      });
  }
  return collectBinderBacklinks(sources, binderId, targetId);
}
