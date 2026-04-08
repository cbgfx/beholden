import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { requireAuth } from "../../middleware/auth.js";

type DeckCardRow = {
  id: string;
  card_name: string;
  card_text: string | null;
  sort_index: number;
};

export function registerDeckRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  app.get("/api/compendium/decks/:deckKey", requireAuth, (req, res) => {
    const deckKey = String(req.params.deckKey ?? "").trim().toLowerCase();
    if (!deckKey) return res.status(400).json({ ok: false, message: "deckKey is required" });

    const rows = db.prepare(
      "SELECT id, card_name, card_text, sort_index FROM compendium_deck_cards WHERE deck_key = ? ORDER BY sort_index ASC, card_name COLLATE NOCASE ASC"
    ).all(deckKey) as DeckCardRow[];

    res.json({
      ok: true,
      deckKey,
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

