import type { MonsterDetail } from "@/domain/types/compendium";
import type { Combatant } from "@/domain/types/domain";

export function applyMonsterAttackOverrides(
  monster: MonsterDetail | null,
  combatant: Combatant | null
): MonsterDetail | null {
  if (!monster || !combatant) return monster;
  const overrides = combatant.attackOverrides;
  if (!overrides || typeof overrides !== "object") return monster;

  const patchText = (text: string, ov: any) => {
    let out = String(text ?? "");
    if (typeof ov?.toHit === "number" && Number.isFinite(ov.toHit)) {
      out = out.replace(/Weapon Attack:\s*\+?\d+\s*to hit/i, (m) => m.replace(/\+?\d+/, `+${ov.toHit}`));
    }
    if (ov?.damage) {
      out = out.replace(/\(\s*[^)]+\s*\)\s*[a-zA-Z]+\s+damage/i, (m) => {
        const type = (ov?.damageType ?? (m.match(/\)\s*([a-zA-Z]+)\s+damage/i)?.[1] ?? "")).toString();
        return `(${ov.damage}) ${type} damage`;
      });
    }
    if (ov?.damageType) {
      out = out.replace(/\)\s*[a-zA-Z]+\s+damage/i, `) ${ov.damageType} damage`);
    }
    return out;
  };

const actions = Array.isArray(monster.action) ? monster.action : [];
  const nextActions = actions.map((a: any) => {
    const name = String(a?.name ?? a?.title ?? "");
    const ov = (overrides as any)[name];
    if (!ov) return a;
    const nextAttack = { ...(a?.attack ?? {}), ...ov };
    const nextText = a?.text ? patchText(a.text, ov) : a?.description ? patchText(a.description, ov) : a?.text;
    return { ...a, attack: nextAttack, text: nextText };
  });

  return { ...monster, action: nextActions };
}
