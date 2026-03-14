import type { MonsterDetail } from "@/domain/types/compendium";

type DifficultyLabel = "Too Easy" | "Easy" | "Medium" | "Hard" | "Deadly" | "TPK";

// ── 5e XP thresholds by character level (DMG p.82) ───────────────────────────
// [easy, medium, hard, deadly]
const XP_THRESHOLDS: Record<number, [number, number, number, number]> = {
  1:  [25,   50,    75,    100  ],
  2:  [50,   100,   150,   200  ],
  3:  [75,   150,   225,   400  ],
  4:  [125,  250,   375,   500  ],
  5:  [250,  500,   750,   1100 ],
  6:  [300,  600,   900,   1400 ],
  7:  [350,  750,   1100,  1700 ],
  8:  [450,  900,   1400,  2100 ],
  9:  [550,  1100,  1600,  2400 ],
  10: [600,  1200,  1900,  2800 ],
  11: [800,  1600,  2400,  3600 ],
  12: [1000, 2000,  3000,  4500 ],
  13: [1100, 2200,  3400,  5100 ],
  14: [1250, 2500,  3800,  5700 ],
  15: [1400, 2800,  4300,  6400 ],
  16: [1600, 3200,  4800,  7200 ],
  17: [2000, 3900,  5900,  8800 ],
  18: [2100, 4200,  6300,  9500 ],
  19: [2400, 4900,  7300,  10900],
  20: [2800, 5700,  8500,  12700],
};

const DIFFICULTY_ORDER: DifficultyLabel[] = ["Too Easy", "Easy", "Medium", "Hard", "Deadly", "TPK"];

// ── DMG monster-count action economy multipliers ──────────────────────────────
const MONSTER_COUNT_MULTIPLIER_TIERS: number[] = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0];
const MONSTER_COUNT_MULTIPLIERS: Array<[number, number]> = [
  [1,  1.0],
  [2,  1.5],
  [6,  2.0],
  [10, 2.5],
  [14, 3.0],
  [Infinity, 4.0],
];

/**
 * DMG monster-count multiplier, adjusted for party size.
 * Small parties (1–2) get one tier up; large parties (6+) get one tier down.
 */
function monsterCountMultiplier(count: number, partySize: number): number {
  if (count <= 0) return 1.0;
  let base = 4.0;
  for (const [max, mult] of MONSTER_COUNT_MULTIPLIERS) {
    if (count <= max) { base = mult; break; }
  }
  const tiers = MONSTER_COUNT_MULTIPLIER_TIERS;
  let idx = tiers.indexOf(base);
  if (idx === -1) idx = tiers.length - 1;
  if (partySize <= 2) idx = Math.min(idx + 1, tiers.length - 1); // small party → harder
  if (partySize >= 6) idx = Math.max(idx - 1, 0);                // large party → easier
  return tiers[idx];
}

function xpDifficultyLabel(totalXp: number, playerLevels: number[]): DifficultyLabel {
  if (!playerLevels.length || totalXp <= 0) return "Too Easy";
  let easy = 0, medium = 0, hard = 0, deadly = 0;
  for (const lvl of playerLevels) {
    const clamped = Math.min(20, Math.max(1, Math.round(lvl)));
    const t = XP_THRESHOLDS[clamped] ?? XP_THRESHOLDS[1];
    easy   += t[0];
    medium += t[1];
    hard   += t[2];
    deadly += t[3];
  }
  if (totalXp >= deadly * 2) return "TPK";
  if (totalXp >= deadly)     return "Deadly";
  if (totalXp >= hard)       return "Hard";
  if (totalXp >= medium)     return "Medium";
  if (totalXp >= easy)       return "Easy";
  return "Too Easy";
}

function worseDifficulty(a: DifficultyLabel, b: DifficultyLabel): DifficultyLabel {
  return DIFFICULTY_ORDER.indexOf(a) >= DIFFICULTY_ORDER.indexOf(b) ? a : b;
}

/**
 * CR ceiling check — catches glass-ceiling scenarios like CR 20 vs level 6 party.
 * Compares the single highest CR hostile monster against the average party level.
 */
function crCeilingLabel(maxCr: number, avgPartyLevel: number): DifficultyLabel {
  if (avgPartyLevel <= 0 || maxCr <= 0) return "Too Easy";
  const ratio = maxCr / avgPartyLevel;
  if (ratio >= 5.0) return "TPK";
  if (ratio >= 3.0) return "Deadly";
  if (ratio >= 2.0) return "Hard";
  if (ratio >= 1.5) return "Medium";
  if (ratio >= 1.0) return "Easy";
  return "Too Easy";
}

export type EncounterDifficulty = {
  label: DifficultyLabel;
  roundsToTpk: number; // partyHP / hostileDPR
  partyHpMax: number;
  hostileDpr: number;
  burstFactor: number;
  adjustedXp: number;
};

const toNumberOrNull = (v: any): number | null => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[, ]/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Parses a 5e-style CR value.
 *
 * Handles common formats safely:
 * - 0, 1, 2, 10, 12
 * - 1/8, 1/4, 1/2 (including with a leading "CR" prefix)
 * - "CR 1/2", "CR1/4", "challenge 2" etc.
 *
 * IMPORTANT: do NOT strip non-digits naively; "1/2" must remain 0.5 (not "12").
 */
const parseCrToNumberOrNull = (cr: unknown): number | null => {
  if (cr == null) return null;
  if (typeof cr === "number" && Number.isFinite(cr)) return cr;

  const s = String(cr).trim();
  if (!s) return null;

  // Prefer explicit fractions first.
  const frac = s.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac?.[1] && frac?.[2]) {
    const a = Number(frac[1]);
    const b = Number(frac[2]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }

  // Then, take the first plain number (integer or decimal) we can find.
  const num = s.match(/-?\d+(?:\.\d+)?/);
  if (num?.[0]) {
    const n = Number(num[0]);
    return Number.isFinite(n) ? n : null;
  }

  return null;
};

// Conservative fallback DPR by CR (rough heuristic, only used when parsing fails).
// Keys are stored as numeric strings to match common imports.
const DPR_BY_CR: Record<string, number> = {
  "0": 2,
  "0.125": 2,
  "0.25": 4,
  "0.5": 6,
  "1": 9,
  "2": 15,
  "3": 21,
  "4": 27,
  "5": 33,
  "6": 39,
  "7": 45,
  "8": 51,
  "9": 57,
  "10": 63,
  "11": 69,
  "12": 75,
  "13": 81,
  "14": 87,
  "15": 93,
  "16": 99,
  "17": 105,
  "18": 111,
  "19": 117,
  "20": 123,
};

const wordToNumber = (w: string): number | null => {
  const s = w.trim().toLowerCase();
  if (!s) return null;
  const direct = toNumberOrNull(s);
  if (direct != null) return direct;
  const map: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  return typeof map[s] === "number" ? map[s] : null;
};

const crToFallbackDpr = (cr: unknown): number | null => {
  const n = parseCrToNumberOrNull(cr);
  if (n == null) return null;

  const direct = DPR_BY_CR[String(n)];
  if (typeof direct === "number") return direct;

  // Snap to nearest known CR key.
  const keys = Object.keys(DPR_BY_CR).map((k) => Number(k)).filter((x) => Number.isFinite(x));
  if (!keys.length) return null;
  let best = keys[0];
  let bestDist = Math.abs(n - best);
  for (const k of keys) {
    const d = Math.abs(n - k);
    if (d < bestDist) {
      best = k;
      bestDist = d;
    }
  }
  const snapped = DPR_BY_CR[String(best)];
  return typeof snapped === "number" ? snapped : null;
};

/**
 * Normalize action text — handles string, string[], or object[].
 * Some compendium formats store action.text as an array of objects with a .text or .description field.
 */
const normalizeActionText = (raw: unknown): string => {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (entry == null) return "";
        if (typeof entry === "string") return entry;
        if (typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          const inner = obj.text ?? obj.description ?? obj.content ?? obj.value;
          if (inner != null) return String(inner);
          return ""; // skip [object Object] noise
        }
        return String(entry);
      })
      .join(" ");
  }
  return String(raw);
};

const parseAvgDamageFromActionText = (text: string): number | null => {
  const t = String(text ?? "");

  // Prefer the explicit average: "Hit: 7 (1d8 + 3) slashing damage"
  const m1 = t.match(/Hit:\s*([0-9]+)\s*\(/i);
  if (m1?.[1]) return Number(m1[1]);

  // Fallback: "Hit: 7 slashing damage" (no dice in parentheses)
  const m2 = t.match(/Hit:\s*([0-9]+)\b/i);
  if (m2?.[1]) return Number(m2[1]);

  return null;
};

const getBurstFactorFromText = (text: string): number => {
  const t = String(text ?? "");
  if (/recharge/i.test(t) || /breath weapon/i.test(t)) return 1.35;
  if (/(each creature|cone|line|radius|sphere|burst)/i.test(t)) return 1.2;
  return 1.0;
};

export function estimateMonsterDpr(detail: MonsterDetail | null | undefined): { dpr: number; burstFactor: number } | null {
  if (!detail) return null;
  const actions: any[] = Array.isArray((detail as any).action) ? (detail as any).action : [];

  // Legendary monsters get extra actions every round — bump DPR by 25%.
  const legendaryRaw = (detail as any).legendary ?? (detail as any).legendaryActions ?? (detail as any).legendary_actions;
  const hasLegendaryActions = Array.isArray(legendaryRaw) && legendaryRaw.length > 0;

  // CR-based fallback DPR — used as a floor to prevent silent parse failures.
  const cr = (detail as any).cr ?? (detail as any).raw_json?.cr ?? (detail as any).raw_json?.challenge_rating;
  const crFallback = crToFallbackDpr(cr);

  // Collect attack-like actions (exclude Multiattack itself).
  const attackByName: Record<string, number> = {};
  let bestSingle = 0;
  let burstFactor = 1.0;

  for (const a of actions) {
    const name = String(a?.name ?? "").trim();
    const text = normalizeActionText(a?.text);
    if (!name) continue;

    burstFactor = Math.max(burstFactor, getBurstFactorFromText(text));

    if (/^multiattack$/i.test(name)) continue;
    const avg = parseAvgDamageFromActionText(text);
    if (avg == null || !Number.isFinite(avg) || avg <= 0) continue;
    attackByName[name.toLowerCase()] = avg;
    bestSingle = Math.max(bestSingle, avg);
  }

  // Multiattack parsing (best effort).
  const multi = actions.find((a) => /^multiattack$/i.test(String(a?.name ?? "").trim()));
  if (multi?.text) {
    const mt = normalizeActionText(multi.text);
    const countMatch = mt.match(/makes\s+([a-z0-9]+)\s+attacks?/i);
    const count = countMatch?.[1] ? wordToNumber(countMatch[1]) : null;

    if (count != null && count > 1) {
      // If the multiattack text references specific attack names, sum those.
      let matchedSum = 0;
      let matchedCount = 0;
      const lowerMt = mt.toLowerCase();
      for (const [n, dmg] of Object.entries(attackByName)) {
        // Require whole-word-ish match to reduce false positives.
        const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(lowerMt)) {
          matchedSum += dmg;
          matchedCount += 1;
        }
      }

      if (matchedCount > 0) {
        // If fewer attacks were explicitly named than the count, pad with the best single attack.
        const padded = matchedSum + Math.max(0, count - matchedCount) * bestSingle;
        const parsedDpr = Math.max(0, padded);
        // CR floor: if parse result is less than 50% of the CR heuristic, use the CR heuristic.
        const baseDpr = crFallback != null && parsedDpr < crFallback * 0.5 ? crFallback : parsedDpr;
        return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
      }

      // Otherwise, assume it repeats its best attack.
      if (bestSingle > 0) {
        const parsedDpr = bestSingle * count;
        const baseDpr = crFallback != null && parsedDpr < crFallback * 0.5 ? crFallback : parsedDpr;
        return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
      }
    }
  }

  // No usable multiattack: assume the monster uses its best attack each round.
  if (bestSingle > 0) {
    const baseDpr = crFallback != null && bestSingle < crFallback * 0.5 ? crFallback : bestSingle;
    return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
  }

  // Last resort: CR fallback.
  if (crFallback != null) return { dpr: crFallback * (hasLegendaryActions ? 1.25 : 1), burstFactor };

  return null;
}

export function labelForRoundsToTpk(rtk: number): DifficultyLabel {
  if (!Number.isFinite(rtk)) return "Too Easy";
  if (rtk <= 1.0) return "TPK";
  if (rtk <= 2.0) return "Deadly";
  if (rtk <= 3.5) return "Hard";
  if (rtk <= 6.0) return "Medium";
  if (rtk <= 10.0) return "Easy";
  return "Too Easy";
}

export function calcEncounterDifficulty(args: {
  partyHpMax: number;
  hostileDpr: number;
  burstFactor?: number;
  totalXp?: number;
  playerLevels?: number[];
  monsterCount?: number;
  maxMonsterCr?: number;
}): EncounterDifficulty {
  const partyHpMax = Math.max(0, Math.round(args.partyHpMax ?? 0));
  const hostileDprRaw = typeof args.hostileDpr === "number" && Number.isFinite(args.hostileDpr) ? Math.max(0, args.hostileDpr) : 0;
  const burstFactor = typeof args.burstFactor === "number" && Number.isFinite(args.burstFactor) ? Math.max(1, args.burstFactor) : 1.0;

  const hostileDpr = hostileDprRaw * burstFactor;
  const roundsToTpk = hostileDpr > 0 ? partyHpMax / hostileDpr : Number.POSITIVE_INFINITY;

  // Signal 1 — Adjusted XP with DMG monster-count multiplier (party-size adjusted).
  const rawXp = typeof args.totalXp === "number" && Number.isFinite(args.totalXp) ? Math.max(0, args.totalXp) : 0;
  const partySize = args.playerLevels?.length ?? 0;
  const mult = monsterCountMultiplier(args.monsterCount ?? 0, partySize);
  const adjustedXp = Math.round(rawXp * mult);
  const adjustedXpLabel = (adjustedXp > 0 && args.playerLevels?.length)
    ? xpDifficultyLabel(adjustedXp, args.playerLevels)
    : "Too Easy";

  // Signal 2 — CR ceiling check.
  const avgPartyLevel = args.playerLevels?.length
    ? args.playerLevels.reduce((s, l) => s + l, 0) / args.playerLevels.length
    : 0;
  const maxCr = typeof args.maxMonsterCr === "number" && Number.isFinite(args.maxMonsterCr) ? args.maxMonsterCr : 0;
  const crLabel = crCeilingLabel(maxCr, avgPartyLevel);

  // Signal 3 — DPR survivability model.
  const dprLabel = labelForRoundsToTpk(roundsToTpk);

  // Take the worst of all three signals.
  const label = worseDifficulty(worseDifficulty(adjustedXpLabel, crLabel), dprLabel);

  return {
    label,
    roundsToTpk,
    partyHpMax,
    hostileDpr: hostileDprRaw,
    burstFactor,
    adjustedXp,
  };
}
