import { titleCase as toTitleCase } from "@/lib/format/titleCase";
import {
  createFeatureEffectId,
  type DefenseEffect,
  type FeatureEffect,
  type FeatureEffectSource,
} from "@/domain/character/featureEffects";

function textUsesRageGate(text: string): boolean {
  return /while your rage is active|while raging/i.test(text);
}

function isBaseRageRulesText(source: FeatureEffectSource, text: string): boolean {
  return /\brage\b/i.test(source.name)
    && /your rage follows the rules below|damage resistance|rage damage|strength advantage/i.test(text);
}

function createRageGate(source: FeatureEffectSource, text: string) {
  return textUsesRageGate(text) || isBaseRageRulesText(source, text)
    ? { duration: "while_raging" as const }
    : undefined;
}

export function parseDefenseEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const DAMAGE_TYPES = [
    "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
    "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
  ] as const;
  const CONDITION_NAMES = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Exhaustion",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
  ];

  const rageGate = createRageGate(source, text);

  const addDamageDefense = (mode: DefenseEffect["mode"], rawTargets: string) => {
    const lower = rawTargets.toLowerCase();
    const targets: string[] = DAMAGE_TYPES.filter((damageType) => new RegExp(`\\b${damageType}\\b`, "i").test(lower));
    if (targets.length === 0 && /nonmagical/i.test(lower) && /bludgeoning|piercing|slashing/i.test(lower)) {
      targets.push("Nonmagical B/P/S");
    }
    if (targets.length === 0) return;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode,
      targets,
      gate: rageGate,
    } satisfies DefenseEffect);
  };

  for (const match of text.matchAll(/resistance to every damage type except ([^.;]+?)(?:damage)?[.;]/gi)) {
    const excluded = new Set(
      DAMAGE_TYPES.filter((damageType) => new RegExp(`\\b${damageType}\\b`, "i").test(match[1] ?? ""))
    );
    const included = DAMAGE_TYPES.filter((damageType) => !excluded.has(damageType));
    if (included.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode: "damage_resistance",
      targets: included,
      gate: rageGate,
      summary: `Resistance to ${included.join(", ")}`,
    } satisfies DefenseEffect);
  }

  for (const match of text.matchAll(/(?:have |gain )?resistance to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_resistance", match[1]);
  }
  for (const match of text.matchAll(/(?:are|become)\s+resistant to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_resistance", match[1]);
  }
  for (const match of text.matchAll(/immune to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_immunity", match[1]);
  }

  const addConditionImmunity = (rawTargets: string) => {
    const targets = rawTargets
      .replace(/\bcondition(s)?\b/gi, "")
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(toTitleCase);
    if (targets.length === 0) return;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode: "condition_immunity",
      targets,
      gate: rageGate,
    } satisfies DefenseEffect);
  };

  for (const match of text.matchAll(/immunity to (?:the\s+)?([A-Za-z,\s]+?) conditions?/gi)) {
    addConditionImmunity(match[1]);
  }

  for (const match of text.matchAll(/immune to (?:the\s+)?([A-Za-z,\s]+?) conditions?/gi)) {
    addConditionImmunity(match[1]);
  }

  for (const condition of CONDITION_NAMES) {
    const escaped = condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`immune to being\\s+${escaped}`, "i").test(text)) {
      addConditionImmunity(condition);
    }
    if (new RegExp(`(?:can(?:not|'t)|cannot)\\s+be\\s+${escaped}`, "i").test(text)) {
      addConditionImmunity(condition);
    }
  }
}

