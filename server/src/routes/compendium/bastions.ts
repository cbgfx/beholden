import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { readBastionSpaces, readCompendiumFacilities, readSpecialFacilitySlots, resolveBastionRuleset } from "../bastions/helpers.js";
import { parseRulesetFilter } from "./helpers.js";

type BastionOrderRow = {
  id: string;
  order_name: string;
  order_key: string;
  sort_index: number;
};

export function registerBastionCompendiumRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/compendium/bastions", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const ruleset = resolveBastionRuleset(db, parseRulesetFilter(req.query.ruleset));

    const orders = db.prepare(
      `SELECT id, order_name, order_key, sort_index FROM compendium_bastion_orders${ruleset ? " WHERE ruleset = ?" : ""} ORDER BY sort_index ASC, order_name COLLATE NOCASE ASC`
    ).all(...(ruleset ? [ruleset] : [])) as BastionOrderRow[];

    res.json({
      ok: true,
      ruleset,
      // Sizes with the compendium's basic facility costs, which the upgrade pill reads.
      spaces: readBastionSpaces(db, ruleset),
      orders: orders.map((row) => ({
        id: row.id,
        name: row.order_name,
        key: row.order_key,
        sort: row.sort_index,
      })),
      facilities: readCompendiumFacilities(db, ruleset),
      // From the compendium's rules entry (the book's progression if it has none yet).
      specialFacilitySlots: readSpecialFacilitySlots(db, ruleset),
    });
  });
}
