export type ParsedAttack = {
  toHit: number | null;
  reach: string | null;
  range: string | null;
  melee: boolean;
  ranged: boolean;
  damage: string | null;
  damageType: string | null;
};

function cleanDice(expr: unknown): string {
  return String(expr ?? "").replace(/\s+/g, "").trim();
}

export function parseAttackFromText(text: unknown): ParsedAttack | null {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const head = raw.match(
    /^(Melee|Ranged|Melee or Ranged)\s+Weapon Attack:\s*\+?(\d+)\s*to hit,\s*([^.]*)\.\s*Hit:\s*([^]*)$/i
  );
  if (!head) return null;

  const mode = (head[1] ?? "").toLowerCase();
  if (!mode) return null;
  const toHit = Number(head[2]);
  const meta = head[3] ?? "";
  const afterHit = head[4] ?? "";

  const melee = mode.includes("melee");
  const ranged = mode.includes("ranged");

  const reachMatch = meta.match(/reach\s*([^,]+)/i);
  const rangeMatch = meta.match(/range\s*([^,]+)/i);

  const reach = reachMatch ? String(reachMatch[1]).replace(/\./g, "").replace(/\s+/g, "") : null;
  const range = rangeMatch ? String(rangeMatch[1]).replace(/\./g, "").trim() : null;

  const dmg = afterHit.match(/\(\s*([^)]+)\s*\)\s*([a-zA-Z]+)\s+damage/i);
  const damage = dmg ? cleanDice(dmg[1]) : null;
  const damageType = dmg ? String(dmg[2]).toLowerCase() : null;

  return {
    toHit: Number.isFinite(toHit) ? toHit : null,
    reach,
    range,
    melee,
    ranged,
    damage,
    damageType,
  };
}

export function applyAttackOverrideToText(
  text: unknown,
  override?: Partial<ParsedAttack> | null
): string {
  const raw = String(text ?? "");
  if (!override) return raw;

  let out = raw;

  if (typeof override.toHit === "number" && Number.isFinite(override.toHit)) {
    out = out.replace(/Weapon Attack:\s*\+?\d+\s*to hit/i, (m) =>
      m.replace(/\+?\d+/, `+${override.toHit}`)
    );
  }
  if (override.damage) {
    out = out.replace(/\(\s*[^)]+\s*\)\s*[a-zA-Z]+\s+damage/i, (m) => {
      const type = override.damageType
        ? String(override.damageType)
        : m.match(/\)\s*([a-zA-Z]+)\s+damage/i)?.[1] ?? "";
      return `(${override.damage}) ${type} damage`;
    });
  }
  if (override.damageType) {
    out = out.replace(/\)\s*[a-zA-Z]+\s+damage/i, `) ${override.damageType} damage`);
  }
  return out;
}
