export type MonsterAbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type MonsterMovementMode = "fly" | "swim" | "climb" | "burrow";

const MONSTER_ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

const SIZE_CODE_TO_LABEL: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

export function toFinite(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function listToString(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (x == null) return "";
        if (typeof x === "string") return x;
        if (typeof x === "number") return String(x);
        if (typeof x === "object") {
          const o = x as Record<string, unknown>;
          if (typeof o.name === "string") return o.name;
          if (typeof o.note === "string" && typeof o.type === "string") return `${o.type} ${o.note}`;
          if (typeof o.type === "string") return o.type;
        }
        return String(x);
      })
      .map((s) => s.trim())
      .filter(Boolean)
      .join(", ");
  }
  if (typeof v === "object") {
    try {
      return Object.entries(v as Record<string, unknown>)
        .map(([k, val]) => `${k} ${String(val).trim()}`)
        .join(", ");
    } catch {
      return "";
    }
  }
  return "";
}

export function readMonsterNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  if (Array.isArray(value)) return readMonsterNumber(value[0]);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = record.value ?? record.average ?? record.avg ?? record.ac ?? record.armor_class ?? record.hit_points ?? record.number;
    if (nested != null && nested !== value) return readMonsterNumber(nested);
  }
  return null;
}

export function parseSpeedVal(sp: unknown): number | null {
  if (typeof sp === "number") return sp;
  if (typeof sp === "string") {
    const m = sp.match(/\d+/);
    return m ? Number(m[0]) : null;
  }
  if (sp && typeof sp === "object") {
    const obj = sp as Record<string, unknown>;
    return readMonsterNumber(obj.walk ?? obj.value ?? obj.speed);
  }
  return null;
}

export function parseSpeedDisplay(sp: unknown): string {
  if (sp == null) return "";
  if (typeof sp === "string") return sp;
  if (typeof sp === "number") return `${sp} ft.`;
  if (typeof sp === "object") {
    const obj = sp as Record<string, unknown>;
    const parts: string[] = [];
    const push = (label: string, val: unknown) => {
      if (val == null) return;
      const s = String(val).trim();
      if (!s) return;
      parts.push(label === "walk" ? s : `${label} ${s}`);
    };
    if (obj.walk != null) push("walk", obj.walk);
    else if (obj.speed != null) push("walk", obj.speed);
    else if (obj.value != null) push("walk", obj.value);
    if (obj.fly != null) push("fly", obj.fly);
    if (obj.climb != null) push("climb", obj.climb);
    if (obj.swim != null) push("swim", obj.swim);
    if (obj.burrow != null) push("burrow", obj.burrow);
    return parts.join(", ");
  }
  return "";
}

export function parseMonsterSpeed(value: unknown): { walk: number | null; modes: Array<{ mode: MonsterMovementMode; speed: number | null }> } {
  if (value == null) return { walk: null, modes: [] };
  if (typeof value === "number") return { walk: value, modes: [] };
  if (typeof value === "string") return { walk: readMonsterNumber(value), modes: [] };
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const walk = readMonsterNumber(record.walk ?? record.speed ?? record.value);
    const modes = (["fly", "swim", "climb", "burrow"] as const)
      .map((mode) => ({ mode, speed: readMonsterNumber(record[mode]) }))
      .filter((entry) => entry.speed != null);
    return { walk, modes };
  }
  return { walk: null, modes: [] };
}

export function parseSaves(raw: unknown): Partial<Record<MonsterAbilityKey, number>> | undefined {
  const out: Partial<Record<MonsterAbilityKey, number>> = {};
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const key = String(record.name ?? "").trim().toLowerCase().slice(0, 3) as MonsterAbilityKey;
    if (!MONSTER_ABILITY_KEYS.includes(key)) continue;
    const bonus = readMonsterNumber(record.bonus);
    if (bonus != null) out[key] = bonus;
  }
  return Object.keys(out).length ? out : undefined;
}

export function proficiencyBonusFromChallengeRating(value: unknown): number {
  const cr = parseCrNumber(value);
  if (!Number.isFinite(cr) || cr <= 0) return 2;
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  if (cr <= 20) return 6;
  if (cr <= 24) return 7;
  if (cr <= 28) return 8;
  return 9;
}

export function readMonsterSkillBonus(monster: unknown, skillName: string): number | null {
  const source = monster as Record<string, unknown> | null;
  const proficiencies = source?.proficiencies && typeof source.proficiencies === "object"
    ? source.proficiencies as Record<string, unknown>
    : null;
  const raw = proficiencies?.skills ?? source?.skills;
  if (!raw) return null;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        if (String(record.name ?? "").trim().toLowerCase() === skillName.toLowerCase()) {
          return readMonsterNumber(record.bonus);
        }
      }
    }
  }
  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    for (const [key, val] of Object.entries(record)) {
      if (key.trim().toLowerCase() === skillName.toLowerCase()) {
        return readMonsterNumber(val);
      }
    }
  }
  return null;
}

export function formatMonsterTypeLabel(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "All types";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildMonsterInfoLines(
  detail: Record<string, unknown>,
  xp?: number | null
): Array<{ label: string; value: string }> {
  const sizeStr = (() => {
    const raw = String(detail.size ?? "").trim().toUpperCase();
    return SIZE_CODE_TO_LABEL[raw] ?? (raw || "");
  })();

  const typeStr = (() => {
    const raw = detail.typeFull ?? detail.type ?? detail.typeKey;
    if (raw == null) return "";
    if (typeof raw === "object") return String((raw as Record<string, unknown>).type ?? "").trim();
    return String(raw).trim();
  })();

  const skillsStr = (() => {
    const raw = detail.skill ?? detail.skills ?? null;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") return listToString(raw);
    return "";
  })();
  const proficiencyBonus = proficiencyBonusFromChallengeRating(
    detail.cr ?? detail.challengeRating ?? detail.challenge_rating,
  );
  const skillsAndProficiency = [
    skillsStr,
    `Proficiency: +${proficiencyBonus}`,
  ].filter(Boolean).join(", ");

  const sensesStr = listToString(detail.senses);
  const langsStr = listToString(detail.languages);

  const crStr = (() => {
    const cr = detail.cr ?? detail.challengeRating ?? detail.challenge_rating;
    if (cr == null) return "";
    const xpSuffix = xp != null ? ` (${xp} XP)` : "";
    return `${cr}${xpSuffix}`;
  })();

  const dmgRes = listToString(detail.damageResist ?? detail.resist ?? detail.resistance);
  const dmgImm = listToString(detail.damageImmune ?? detail.immune ?? detail.immunity);
  const dmgVuln = listToString(detail.damageVulnerable ?? detail.vulnerable ?? detail.vulnerability);
  const condImm = listToString(detail.conditionImmune ?? detail.conditionImmunity ?? detail.condImmune);

  const typeDisplay = typeStr ? typeStr.charAt(0).toUpperCase() + typeStr.slice(1) : "";

  return [
    ...(sizeStr ? [{ label: "Size", value: sizeStr }] : []),
    ...(typeDisplay ? [{ label: "Type", value: typeDisplay }] : []),
    { label: "Skills", value: skillsAndProficiency },
    ...(sensesStr ? [{ label: "Senses", value: sensesStr }] : []),
    ...(langsStr ? [{ label: "Languages", value: langsStr }] : []),
    ...(crStr ? [{ label: "Challenge Rating", value: crStr }] : []),
    ...(dmgRes ? [{ label: "Damage Resistances", value: dmgRes }] : []),
    ...(dmgVuln ? [{ label: "Damage Vulnerabilities", value: dmgVuln }] : []),
    ...(dmgImm ? [{ label: "Damage Immunities", value: dmgImm }] : []),
    ...(condImm ? [{ label: "Condition Immunities", value: condImm }] : []),
  ];
}

export function normalizeSpellName(name: string): string {
  return name
    .replace(/\([^)]+\)\s*$/g, "")
    .replace(/\s*\[[^\]]+\]\s*$/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseCrNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const text = String(value ?? "").trim();
  if (!text) return NaN;
  if (text.includes("/")) {
    const [num, den] = text.split("/");
    const numerator = Number(num);
    const denominator = Number(den);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : NaN;
}

/** Average HP from a dice formula per the printed-statblock floor rule:
 * floor(N * (faces + 1) / 2) + modifier. Returns null when the formula isn't NdF(+/-M). */
export function averageHpFromFormula(formula: string | null | undefined): number | null {
  const match = String(formula ?? "").replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) return null;
  const count = Number(match[1]);
  const faces = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (!Number.isFinite(count) || !Number.isFinite(faces) || faces <= 0) return null;
  return Math.floor((count * (faces + 1)) / 2) + modifier;
}

/** Numeric CR from its display rating ("1/2" -> 0.5, "10" -> 10). */
export function crRatingToNumber(rating: string | number | null | undefined): number | null {
  if (typeof rating === "number") return Number.isFinite(rating) ? rating : null;
  const text = String(rating ?? "").trim();
  if (!text) return null;
  if (text.includes("/")) {
    const [n = NaN, d = NaN] = text.split("/").map(Number);
    return Number.isFinite(n) && Number.isFinite(d) && d !== 0 ? n / d : null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}
