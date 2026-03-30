import type { MonsterDetail } from "@/domain/types/compendium";
import { parseCrToNumberOrNull, findNearestValue } from "@/domain/utils/crParsing";

type DifficultyLabel = "Too Easy" | "Easy" | "Medium" | "Hard" | "Deadly" | "TPK";

// Conservative fallback DPR by CR (rough heuristic, only used when parsing fails).
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
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  const map: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  };
  return typeof map[s] === "number" ? map[s] : null;
};

const crToFallbackDpr = (cr: unknown): number | null => {
  const n = parseCrToNumberOrNull(cr);
  if (n == null) return null;
  const direct = DPR_BY_CR[String(n)];
  if (typeof direct === "number") return direct;
  return findNearestValue(n, DPR_BY_CR);
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
          return "";
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

  const multi = actions.find((a) => /^multiattack$/i.test(String(a?.name ?? "").trim()));
  if (multi?.text) {
    const mt = normalizeActionText(multi.text);
    const countMatch = mt.match(/makes\s+([a-z0-9]+)\s+attacks?/i);
    const count = countMatch?.[1] ? wordToNumber(countMatch[1]) : null;

    if (count != null && count > 1) {
      let matchedSum = 0;
      let matchedCount = 0;
      const lowerMt = mt.toLowerCase();
      for (const [n, dmg] of Object.entries(attackByName)) {
        const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(lowerMt)) {
          matchedSum += dmg;
          matchedCount += 1;
        }
      }

      if (matchedCount > 0) {
        const padded = matchedSum + Math.max(0, count - matchedCount) * bestSingle;
        const parsedDpr = Math.max(0, padded);
        const baseDpr = crFallback != null && parsedDpr < crFallback * 0.5 ? crFallback : parsedDpr;
        return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
      }

      if (bestSingle > 0) {
        const parsedDpr = bestSingle * count;
        const baseDpr = crFallback != null && parsedDpr < crFallback * 0.5 ? crFallback : parsedDpr;
        return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
      }
    }
  }

  if (bestSingle > 0) {
    const baseDpr = crFallback != null && bestSingle < crFallback * 0.5 ? crFallback : bestSingle;
    return { dpr: baseDpr * (hasLegendaryActions ? 1.25 : 1), burstFactor };
  }

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
