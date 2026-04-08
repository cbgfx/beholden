export function parseAC(raw: unknown): {
  value: number | null;
  details?: string;
} {
  if (typeof raw === "number") return { value: raw };

  if (typeof raw === "string") {
    const match = raw.match(/\d+/);
    return {
      value: match ? Number(match[0]) : null,
      details: raw.replace(match?.[0] ?? "", "").trim() || undefined,
    };
  }

  if (raw && typeof raw === "object" && "value" in raw) {
    return {
      value: Number((raw as any).value) || null,
      details: (raw as any).details,
    };
  }

  return { value: null };
}

export function parseHP(
  current: unknown,
  max: unknown
): { current: number | null; max: number | null; details?: string } {
  return {
    current: typeof current === "number" ? current : null,
    max: typeof max === "number" ? max : null,
  };
}

export function parseAbilityScore(raw: unknown): number | null {
  return typeof raw === "number" ? raw : null;
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}
