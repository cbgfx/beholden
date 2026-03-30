// server/src/routes/compendium.ts
// Aggregates all compendium route modules.

import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireAnyDm } from "../middleware/auth.js";
import { registerMonsterRoutes } from "./compendium/monsters.js";
import { registerItemRoutes } from "./compendium/items.js";
import { registerSpellRoutes } from "./compendium/spells.js";
import { registerLoreRoutes } from "./compendium/lore.js";
import { registerCompendiumAdminRoutes } from "./compendium/admin.js";

export function registerCompendiumRoutes(app: Express, ctx: ServerContext) {
  const anyDm = requireAnyDm(ctx.db);
  registerMonsterRoutes(app, ctx, anyDm);
  registerItemRoutes(app, ctx, anyDm);
  registerSpellRoutes(app, ctx, anyDm);
  registerLoreRoutes(app, ctx);
  registerCompendiumAdminRoutes(app, ctx);
}
