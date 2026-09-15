import { api } from "@/services/api";
import type { LevelUpSpellSummary } from "./LevelUpTypes";

/** Level-up choices need the complete eligible catalogue, not just its first page. */
export async function fetchLevelUpSpellOptions(query: string): Promise<LevelUpSpellSummary[]> {
  const rows: LevelUpSpellSummary[] = [];
  for (;;) {
    const page = await api<{ rows: LevelUpSpellSummary[]; total: number }>(
      `/api/spells/search?${query}&limit=250&offset=${rows.length}&withTotal=1`,
    );
    if (!Array.isArray(page.rows)) throw new Error("Could not load spell options.");
    rows.push(...page.rows);
    if (rows.length >= page.total) return rows;
    if (!page.rows.length) throw new Error("Spell options were incomplete. Please reload.");
  }
}
