import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import type { StoredTreasure } from "../server/userData.js";

export function registerTreasureRoutes(app: Express, ctx: ServerContext) {
  const { userData, compendium } = ctx;
  const { uid, now, bySortThenUpdatedDesc, nextSort, normalizeKey } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/treasure", (req, res) => {
    const { campaignId } = req.params;
    const c = userData.campaigns[campaignId];
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const rows = Object.values(userData.treasure)
      .filter((t) => t.campaignId === campaignId && (t.adventureId == null || t.adventureId === ""))
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.get("/api/adventures/:adventureId/treasure", (req, res) => {
    const { adventureId } = req.params;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const rows = Object.values(userData.treasure)
      .filter((t) => t.adventureId === adventureId)
      .sort(bySortThenUpdatedDesc);
    res.json(rows);
  });

  app.post("/api/campaigns/:campaignId/treasure", (req, res) => {
    const { campaignId } = req.params;
    const c = userData.campaigns[campaignId];
    if (!c) return res.status(404).json({ ok: false, message: "Campaign not found" });
    const source = String(req.body?.source ?? "compendium") as "compendium" | "custom";
    const out = createTreasureEntry({ campaignId, adventureId: null, source, itemId: req.body?.itemId, custom: req.body?.custom });
    if (out.error) return res.status(out.error.status).json({ ok: false, message: out.error.message });
    ctx.scheduleSave();
    ctx.broadcast("treasure:changed", { campaignId });
    res.json(out.entry);
  });

  app.post("/api/adventures/:adventureId/treasure", (req, res) => {
    const { adventureId } = req.params;
    const a = userData.adventures[adventureId];
    if (!a) return res.status(404).json({ ok: false, message: "Adventure not found" });
    const source = String(req.body?.source ?? "compendium") as "compendium" | "custom";
    const out = createTreasureEntry({ campaignId: a.campaignId, adventureId, source, itemId: req.body?.itemId, custom: req.body?.custom });
    if (out.error) return res.status(out.error.status).json({ ok: false, message: out.error.message });
    ctx.scheduleSave();
    ctx.broadcast("treasure:changed", { campaignId: a.campaignId });
    res.json(out.entry);
  });

  app.delete("/api/treasure/:treasureId", (req, res) => {
    const { treasureId } = req.params;
    const t = userData.treasure[treasureId];
    if (!t) return res.status(404).json({ ok: false, message: "Treasure not found" });
    const campaignId = t.campaignId;
    delete userData.treasure[treasureId];
    ctx.scheduleSave();
    ctx.broadcast("treasure:changed", { campaignId });
    res.json({ ok: true });
  });

  type TreasureResult =
    | { entry: StoredTreasure; error?: never }
    | { error: { status: number; message: string }; entry?: never };

  function createTreasureEntry({
    campaignId,
    adventureId,
    source,
    itemId,
    custom,
  }: {
    campaignId: string;
    adventureId?: string | null;
    source: "compendium" | "custom";
    itemId?: unknown;
    custom?: unknown;
  }): TreasureResult {
    const id = uid();
    const t = now();

    let name = "New Item";
    let rarity: string | null = null;
    let type: string | null = null;
    let typeKey: string | null = null;
    let attunement = false;
    let magic = false;
    let text = "";

    if (source === "compendium") {
      const it = compendium.state.items.find((x) => String(x.id) === String(itemId));
      if (!it) return { error: { status: 404, message: "Item not found in compendium" } };
      name = it.name;
      rarity = it.rarity ?? null;
      type = it.type ?? null;
      typeKey = it.typeKey ?? null;
      attunement = Boolean(it.attunement);
      magic = Boolean(it.magic);
      text = it.text ?? "";
    } else {
      const c = custom as Record<string, unknown> ?? {};
      name = String(c.name ?? "New Item").trim() || "New Item";
      rarity = c.rarity != null ? String(c.rarity).trim() : null;
      type = c.type != null ? String(c.type).trim() : null;
      typeKey = type ? normalizeKey(type) : null;
      attunement = Boolean(c.attunement);
      magic = Boolean(c.magic);
      text = c.text != null ? String(c.text) : "";
    }

    const existing = Object.values(userData.treasure).filter(
      (x) => x.campaignId === campaignId && String(x.adventureId ?? "") === String(adventureId ?? "")
    );
    const sort = nextSort(existing);

    const entry: StoredTreasure = {
      id,
      campaignId,
      adventureId: adventureId ?? null,
      source,
      itemId: itemId != null ? String(itemId) : null,
      name,
      rarity,
      type,
      type_key: typeKey,
      attunement,
      magic,
      text,
      sort,
      createdAt: t,
      updatedAt: t,
    };

    userData.treasure[id] = entry;
    return { entry };
  }
}
