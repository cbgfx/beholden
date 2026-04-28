import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { normalizeResourceKey } from "@/views/character/CharacterSheetUtils";
import {
  createFeatureEffectId,
  type FeatureEffect,
  type FeatureEffectSource,
} from "@/domain/character/featureEffects";
import { parseWordCount } from "@/domain/character/parseFeatureEffects.normalizers";

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export function parseResourceGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const reset =
    /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : undefined;

  const bardicInspirationUsesMatch = text.match(/(?:you can confer a Bardic Inspiration die|you can use Bardic Inspiration)[^.]*a number of times equal to your Charisma modifier(?:\s*\(minimum of once\))?/i);
  if (bardicInspirationUsesMatch && reset) {
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey("Bardic Inspiration"),
      label: "Bardic Inspiration",
      max: { kind: "ability_mod", ability: "cha", min: 1 },
      reset,
      restoreAmount: "all",
      summary: "Bardic Inspiration uses",
    });
  }

  const bardicInspirationResetMatch = text.match(/regain all your expended uses of Bardic Inspiration when you finish a (Short or Long|Short|Long) Rest/i);
  if (bardicInspirationResetMatch) {
    const bardicReset =
      /Short or Long/i.test(bardicInspirationResetMatch[1]) ? "short_or_long_rest"
      : /Short/i.test(bardicInspirationResetMatch[1]) ? "short_rest"
      : "long_rest";
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey("Bardic Inspiration"),
      label: "Bardic Inspiration",
      max: { kind: "ability_mod", ability: "cha", min: 1 },
      reset: bardicReset,
      restoreAmount: "all",
      summary: "Bardic Inspiration uses",
    });
  }

  for (const match of text.matchAll(/you have a number of ([A-Z][A-Za-z' -]+?) equal to your Proficiency Bonus/gi)) {
    const label = match[1]?.trim();
    if (!label || !reset) continue;

    const hasSpendLanguage = new RegExp(`spend (?:the )?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)
      || /spend the points/i.test(text);
    const hasRegainLanguage =
      new RegExp(`regain your expended ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)
      || /regain your expended points/i.test(text);
    if (!hasSpendLanguage || !hasRegainLanguage) continue;

    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey(`${source.name}:${label}`),
      label,
      max: { kind: "proficiency_bonus" },
      reset,
      restoreAmount: "all",
      summary: `${label} equal to your Proficiency Bonus`,
    });
  }

  const sourceLabel = String(source.name ?? "").replace(/^Level\s+\d+\s*:\s*/i, "").trim();
  const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fixedUseMatch = text.match(new RegExp(`you can use (?:the )?(?:${escapedLabel}|this feature)\\s+(once|twice|one|two|three|four|five|six|\\d+)`, "i"));
  const fixedUses = parseWordCount(fixedUseMatch?.[1] ?? "");
  const regainsOneOnShort = /regain one expended use when you finish a short rest/i.test(text);
  const regainsAllOnLong = /regain all expended uses when you finish a long rest/i.test(text);
  const regainsAllOnShortOrLong = /regain all expended uses when you finish a short or long rest/i.test(text);
  const regainsAllOnShort = /regain all expended uses when you finish a short rest/i.test(text);
  const regainsAllOnRest =
    regainsAllOnShortOrLong ? "short_or_long_rest"
    : regainsAllOnShort ? "short_rest"
    : regainsAllOnLong ? "long_rest"
    : null;

  if (sourceLabel && fixedUses && (regainsOneOnShort || regainsAllOnRest)) {
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey(sourceLabel),
      label: sourceLabel,
      max: { kind: "fixed", value: fixedUses },
      reset: regainsOneOnShort ? "short_rest" : regainsAllOnRest!,
      restoreAmount: regainsOneOnShort ? "one" : "all",
      summary: `${sourceLabel} uses`,
    });
  }

  const pbUsesRe = new RegExp(
    `you can use (?:this\\s+(?:feature|trait|benefit|ability)|(?:(?:this|the)\\s+)?${escapedLabel})\\s+a\\s+number of times equal to your Proficiency Bonus`,
    "i",
  );
  const hasPbUsesLanguage = sourceLabel && pbUsesRe.test(text);
  if (hasPbUsesLanguage && (regainsOneOnShort || regainsAllOnRest)) {
    const alreadyEmitted = effects.some(
      (e) => e.type === "resource_grant" && e.source === source && (e as { resourceKey?: string }).resourceKey === normalizeResourceKey(sourceLabel),
    );
    if (!alreadyEmitted) {
      effects.push({
        id: createFeatureEffectId(source, "resource_grant", effects.length),
        type: "resource_grant",
        source,
        resourceKey: normalizeResourceKey(sourceLabel),
        label: sourceLabel,
        max: { kind: "proficiency_bonus" },
        reset: regainsOneOnShort ? "short_rest" : regainsAllOnRest!,
        restoreAmount: regainsOneOnShort ? "one" : "all",
        summary: `${sourceLabel} uses (PB)`,
      });
    }
  }

  for (const match of text.matchAll(/you can use (?:the )?(?:this feature|this trait|this ability|this benefit|[A-Z][A-Za-z' -]+?) a number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier(?:\s*\(minimum of once\))?/gi)) {
    if (!reset) continue;
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    if (!ability) continue;
    const label = sourceLabel || match[0].replace(/^you can use (?:the )?/i, "").trim();
    const resourceKey = normalizeResourceKey(label);
    const alreadyEmitted = effects.some(
      (e) => e.type === "resource_grant" && e.source === source && (e as { resourceKey?: string }).resourceKey === resourceKey,
    );
    if (alreadyEmitted) continue;
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label,
      max: { kind: "ability_mod", ability, min: 1 },
      reset,
      restoreAmount: "all",
      summary: `${label} uses`,
    });
  }
}

