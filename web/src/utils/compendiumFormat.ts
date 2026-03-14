// web/src/utils/compendiumFormat.ts
// Shared helpers for rendering compendium monster data.
// Used by MonsterStatblock, useCharacterSheetStats, useCombatantDetailsModel.

import type { AbilityKey } from "@/components/CharacterSheet";

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

export function toFinite(n: unknown, fallback: number): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

// ---------------------------------------------------------------------------
// listToString — turns any compendium field into a display string
// ---------------------------------------------------------------------------

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
          if (typeof o["name"] === "string") return o["name"];
          if (typeof o["note"] === "string" && typeof o["type"] === "string")
            return `${o["type"]} ${o["note"]}`;
          if (typeof o["type"] === "string") return o["type"];
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

// ---------------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------------

export function parseSpeedVal(sp: unknown): number | null {
  if (typeof sp === "number") return sp;
  if (typeof sp === "string") {
    const m = sp.match(/\d+/);
    return m ? Number(m[0]) : null;
  }
  if (sp && typeof sp === "object") {
    const obj = sp as Record<string, unknown>;
    const w = obj["walk"] ?? obj["value"] ?? obj["speed"];
    if (typeof w === "number") return w;
    if (typeof w === "string") {
      const m = w.match(/\d+/);
      return m ? Number(m[0]) : null;
    }
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
    if (obj["walk"] != null) push("walk", obj["walk"]);
    else if (obj["speed"] != null) push("walk", obj["speed"]);
    else if (obj["value"] != null) push("walk", obj["value"]);
    if (obj["fly"] != null) push("fly", obj["fly"]);
    if (obj["climb"] != null) push("climb", obj["climb"]);
    if (obj["swim"] != null) push("swim", obj["swim"]);
    if (obj["burrow"] != null) push("burrow", obj["burrow"]);
    return parts.join(", ");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Saving throws
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;

export function parseSaves(
  raw: unknown
): Partial<Record<AbilityKey, number>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const out: Partial<Record<AbilityKey, number>> = {};
  for (const k of ABILITY_KEYS) {
    const v =
      obj[k] ??
      obj[k.toUpperCase()] ??
      obj[k.charAt(0).toUpperCase() + k.slice(1)];
    if (v == null) continue;
    const n = Number(String(v).replace(/[^0-9-]/g, ""));
    if (Number.isFinite(n)) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

// ---------------------------------------------------------------------------
// Info lines (Skills / Senses / Languages / CR / resistances etc.)
// ---------------------------------------------------------------------------

const SIZE_CODE_TO_LABEL: Record<string, string> = {
  T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
};

export function buildMonsterInfoLines(
  detail: Record<string, unknown>,
  xp?: number | null
): Array<{ label: string; value: string }> {
  const sizeStr = (() => {
    const raw = String(detail["size"] ?? "").trim().toUpperCase();
    return SIZE_CODE_TO_LABEL[raw] ?? (raw || "");
  })();

  const skillsStr = (() => {
    const raw = detail["skill"] ?? detail["skills"] ?? null;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") return listToString(raw);
    return "";
  })();

  const sensesStr = listToString(detail["senses"]);
  const langsStr = listToString(detail["languages"]);

  const crStr = (() => {
    const cr = detail["cr"] ?? detail["challengeRating"] ?? detail["challenge_rating"];
    if (cr == null) return "";
    const xpSuffix = xp != null ? ` (${xp} XP)` : "";
    return `${cr}${xpSuffix}`;
  })();

  const dmgRes = listToString(detail["damageResist"] ?? detail["resist"] ?? detail["resistance"]);
  const dmgImm = listToString(detail["damageImmune"] ?? detail["immune"] ?? detail["immunity"]);
  const dmgVuln = listToString(detail["damageVulnerable"] ?? detail["vulnerable"] ?? detail["vulnerability"]);
  const condImm = listToString(
    detail["conditionImmune"] ?? detail["conditionImmunity"] ?? detail["condImmune"]
  );

  return [
    ...(sizeStr ? [{ label: "Size", value: sizeStr }] : []),
    { label: "Skills", value: skillsStr || "—" },
    { label: "Senses", value: sensesStr || "—" },
    { label: "Languages", value: langsStr || "—" },
    { label: "Challenge Rating", value: crStr || "—" },
    { label: "Damage Resistances", value: dmgRes || "—" },
    { label: "Damage Vulnerabilities", value: dmgVuln || "—" },
    { label: "Damage Immunities", value: dmgImm || "—" },
    { label: "Condition Immunities", value: condImm || "—" },
  ];
}

export function normalizeSpellName(name: string): string {
  return name.replace(/\([^)]+\)\s*$/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}