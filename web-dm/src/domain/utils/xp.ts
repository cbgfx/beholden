import type { MonsterDetail } from "@/domain/types/compendium";
import { toNumberOrNull, parseCrToNumberOrNull, findNearestValue } from "@/domain/utils/crParsing";

// XP by Challenge Rating (DMG / Basic Rules).
// Many compendium imports do not provide `xp`, so we fall back to CR.
const XP_BY_CR: Record<string, number> = {
  "0": 10,
  "0.125": 25,
  "0.25": 50,
  "0.5": 100,
  "1": 200,
  "2": 450,
  "3": 700,
  "4": 1100,
  "5": 1800,
  "6": 2300,
  "7": 2900,
  "8": 3900,
  "9": 5000,
  "10": 5900,
  "11": 7200,
  "12": 8400,
  "13": 10000,
  "14": 11500,
  "15": 13000,
  "16": 15000,
  "17": 18000,
  "18": 20000,
  "19": 22000,
  "20": 25000,
  "21": 33000,
  "22": 41000,
  "23": 50000,
  "24": 62000,
  "25": 75000,
  "26": 90000,
  "27": 105000,
  "28": 120000,
  "29": 135000,
  "30": 155000
};

const crToXp = (cr: unknown): number | null => {
  const n = parseCrToNumberOrNull(cr);
  if (n == null) return null;

  const direct = XP_BY_CR[String(n)];
  if (typeof direct === "number") return direct;

  // Some imports store CR as 0.333... or similar; snap to nearest known key.
  return findNearestValue(n, XP_BY_CR);
};

/**
 * Best-effort XP lookup for a monster detail payload.
 *
 * Server currently returns `xp` at the top-level for /api/compendium/monsters/:id,
 * but older imports may only include it in raw_json.
 */
export function getMonsterXp(detail: MonsterDetail | null | undefined): number | null {
  if (!detail) return null;
  const anyDetail: any = detail;
  const direct = toNumberOrNull(anyDetail.xp ?? anyDetail.experience);
  if (direct != null) return direct;

  const raw = anyDetail.raw_json ?? anyDetail.rawJson ?? null;
  const rawXp = toNumberOrNull(raw?.xp ?? raw?.experience);
  if (rawXp != null) return rawXp;

  // CR fallback.
  const cr = anyDetail.cr ?? raw?.cr ?? raw?.challenge_rating;
  return crToXp(cr);
}
