import type { MonsterDetail, MonsterTextEntry } from "@/domain/types/compendium";
import type { AttackOverride, EncounterActor } from "@/domain/types/domain";

export function applyMonsterAttackOverrides(
  monster: MonsterDetail | null,
  combatant: EncounterActor | null
): MonsterDetail | null {
  if (!monster || !combatant) return monster;
  const overrides = combatant.attackOverrides;
  if (!overrides || typeof overrides !== "object") return monster;

  const typedOverrides = overrides as Record<string, AttackOverride>;

  const actions = Array.isArray(monster.action) ? monster.action : [];
  const nextActions = actions.map((a: MonsterTextEntry) => {
    const name = String(a?.name ?? a?.title ?? "");
    const ov = typedOverrides[name];
    if (!ov) return a;
    const nextAttack = { ...((a?.attack as Record<string, unknown> | undefined) ?? {}), ...ov };
    return { ...a, attack: nextAttack };
  });

  return { ...monster, action: nextActions };
}
