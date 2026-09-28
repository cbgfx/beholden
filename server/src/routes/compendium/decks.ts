import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { applySharedApiCacheHeaders } from "../../lib/cacheHeaders.js";
import { requireAuth } from "../../middleware/auth.js";
import { parseRulesetFilter } from "./helpers.js";

type DeckCardRow = {
  id: string;
  ruleset: "5e" | "5.5e";
  card_name: string;
  card_text: string | null;
  sort_index: number;
};

export function registerDeckRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/compendium/decks/:deckKey", requireAuth, (req, res) => {
    applySharedApiCacheHeaders(res, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
    const deckKey = String(req.params.deckKey ?? "").trim().toLowerCase();
    if (!deckKey) return res.status(400).json({ ok: false, message: "deckKey is required" });

    const requestedRuleset = parseRulesetFilter(req.query.ruleset);
    const selectedRuleset = requestedRuleset ?? (db.prepare(
      "SELECT ruleset FROM compendium_deck_cards WHERE deck_key = ? ORDER BY CASE WHEN ruleset = '5.5e' THEN 0 ELSE 1 END LIMIT 1",
    ).get(deckKey) as { ruleset?: "5e" | "5.5e" } | undefined)?.ruleset;
    const rows = selectedRuleset ? db.prepare(
      "SELECT id, ruleset, card_name, card_text, sort_index FROM compendium_deck_cards WHERE deck_key = ? AND ruleset = ? ORDER BY sort_index ASC, card_name COLLATE NOCASE ASC",
    ).all(deckKey, selectedRuleset) as DeckCardRow[] : [];

    res.json({
      ok: true,
      deckKey,
      ruleset: selectedRuleset ?? null,
      count: rows.length,
      cards: rows.map((row) => ({
        id: row.id,
        name: row.card_name,
        text: row.card_text ?? "",
        sort: row.sort_index,
      })),
    });
  });
}
