import { estimateMonsterDpr, labelForRoundsToTpk } from "@/domain/utils/monsterDpr";

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
  if (partySize <= 2) idx = Math.min(idx + 1, tiers.length - 1);
  if (partySize >= 6) idx = Math.max(idx - 1, 0);
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
  roundsToTpk: number;
  partyHpMax: number;
  hostileDpr: number;
  burstFactor: number;
  adjustedXp: number;
};

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

  const rawXp = typeof args.totalXp === "number" && Number.isFinite(args.totalXp) ? Math.max(0, args.totalXp) : 0;
  const partySize = args.playerLevels?.length ?? 0;
  const mult = monsterCountMultiplier(args.monsterCount ?? 0, partySize);
  const adjustedXp = Math.round(rawXp * mult);
  const adjustedXpLabel = (adjustedXp > 0 && args.playerLevels?.length)
    ? xpDifficultyLabel(adjustedXp, args.playerLevels)
    : "Too Easy";

  const avgPartyLevel = args.playerLevels?.length
    ? args.playerLevels.reduce((s, l) => s + l, 0) / args.playerLevels.length
    : 0;
  const maxCr = typeof args.maxMonsterCr === "number" && Number.isFinite(args.maxMonsterCr) ? args.maxMonsterCr : 0;
  const crLabel = crCeilingLabel(maxCr, avgPartyLevel);

  const dprLabel = labelForRoundsToTpk(roundsToTpk);

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
