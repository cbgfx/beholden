import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { parseJson } from "../../lib/db.js";

type BastionSpaceRow = {
  id: string;
  name: string;
  name_key: string;
  squares: number | null;
  label: string | null;
  sort_index: number;
};

type BastionOrderRow = {
  id: string;
  order_name: string;
  order_key: string;
  sort_index: number;
};

type BastionFacilityRow = {
  id: string;
  name: string;
  name_key: string;
  facility_type: string;
  minimum_level: number;
  prerequisite: string | null;
  orders_json: string;
  space: string | null;
  hirelings: number | null;
  allow_multiple: number;
  description: string | null;
};

export function registerBastionCompendiumRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/compendium/bastions", requireAuth, (_req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const spaces = db.prepare(
      "SELECT id, name, name_key, squares, label, sort_index FROM compendium_bastion_spaces ORDER BY sort_index ASC, name COLLATE NOCASE ASC"
    ).all() as BastionSpaceRow[];

    const orders = db.prepare(
      "SELECT id, order_name, order_key, sort_index FROM compendium_bastion_orders ORDER BY sort_index ASC, order_name COLLATE NOCASE ASC"
    ).all() as BastionOrderRow[];

    const facilities = db.prepare(
      "SELECT id, name, name_key, facility_type, minimum_level, prerequisite, orders_json, space, hirelings, allow_multiple, description FROM compendium_bastion_facilities ORDER BY minimum_level ASC, name COLLATE NOCASE ASC"
    ).all() as BastionFacilityRow[];

    res.json({
      ok: true,
      spaces: spaces.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.name_key,
        squares: row.squares,
        label: row.label,
        sort: row.sort_index,
      })),
      orders: orders.map((row) => ({
        id: row.id,
        name: row.order_name,
        key: row.order_key,
        sort: row.sort_index,
      })),
      facilities: facilities.map((row) => ({
        id: row.id,
        name: row.name,
        key: row.name_key,
        type: row.facility_type === "basic" ? "basic" : "special",
        minimumLevel: row.minimum_level,
        prerequisite: row.prerequisite,
        orders: parseJson<string[]>(row.orders_json, []),
        space: row.space,
        hirelings: row.hirelings,
        allowMultiple: row.allow_multiple === 1,
        description: row.description,
      })),
      specialSlotProgression: [
        { level: 5, slots: 2 },
        { level: 9, slots: 4 },
        { level: 13, slots: 5 },
        { level: 17, slots: 6 },
      ],
    });
  });
}
