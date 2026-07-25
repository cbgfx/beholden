// server/src/routes/compendium/rulesets.ts
// Which rulesets actually have content loaded, per browsable category. Search/browse UIs use
// this to decide whether a ruleset filter is worth showing at all (hide it when a category has
// only one ruleset's worth of data) and what to default it to.

import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireAuth } from "../../middleware/auth.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";

const RULESET_ORDER = ["5.5e", "5e"] as const;

function sortRulesets(values: Iterable<string>): Array<"5e" | "5.5e"> {
  const set = new Set(values);
  return RULESET_ORDER.filter((ruleset) => set.has(ruleset));
}

export function registerCompendiumRulesetsRoute(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/compendium/rulesets", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const tables: Record<string, string> = {
      monsters: "compendium_monsters",
      spells: "compendium_spells",
      items: "compendium_items",
      feats: "compendium_feats",
      classes: "compendium_classes",
      species: "compendium_races",
      backgrounds: "compendium_backgrounds",
    };
    const out: Record<string, Array<"5e" | "5.5e">> = {};
    for (const [category, table] of Object.entries(tables)) {
      const rows = db.prepare(`SELECT DISTINCT ruleset FROM ${table}`).all() as Array<{ ruleset: string }>;
      out[category] = sortRulesets(rows.map((row) => row.ruleset));
    }
    res.json(out);
  });
}
