import { z, ZodError } from "zod";
import { MonsterSchema } from "./grandCompendiumSchemas.monster.js";
import { ItemSchema } from "./grandCompendiumSchemas.item.js";
import { SpellSchema } from "./grandCompendiumSchemas.spell.js";
import { ClassTalentSchema } from "./grandCompendiumSchemas.classTalent.js";
import { ClassSchema } from "./grandCompendiumSchemas.class.js";
import { SpeciesSchema } from "./grandCompendiumSchemas.species.js";
import { BackgroundSchema } from "./grandCompendiumSchemas.background.js";
import { FeatSchema } from "./grandCompendiumSchemas.feat.js";
import { DeckSchema, BastionSchema } from "./grandCompendiumSchemas.misc.js";

export type { NativeCompendiumCategory } from "./grandCompendiumSchemas.shared.js";
export { GRAND_COMPENDIUM_SCHEMA_VERSION } from "./grandCompendiumSchemas.shared.js";
export { MonsterSchema } from "./grandCompendiumSchemas.monster.js";
export { ItemSchema } from "./grandCompendiumSchemas.item.js";
export { SpellSchema } from "./grandCompendiumSchemas.spell.js";
export { ClassTalentSchema } from "./grandCompendiumSchemas.classTalent.js";
export { ClassSchema } from "./grandCompendiumSchemas.class.js";
export { SpeciesSchema } from "./grandCompendiumSchemas.species.js";
export { BackgroundSchema } from "./grandCompendiumSchemas.background.js";
export { FeatSchema } from "./grandCompendiumSchemas.feat.js";
export { DeckSchema, BastionSchema } from "./grandCompendiumSchemas.misc.js";

import type { NativeCompendiumCategory } from "./grandCompendiumSchemas.shared.js";

export const CATEGORY_SCHEMAS: Record<NativeCompendiumCategory, z.ZodTypeAny> = {
  monsters: MonsterSchema,
  items: ItemSchema,
  spells: SpellSchema,
  classTalents: ClassTalentSchema,
  classes: ClassSchema,
  species: SpeciesSchema,
  backgrounds: BackgroundSchema,
  feats: FeatSchema,
  decks: DeckSchema,
  bastions: BastionSchema,
};

export function parseGrandCompendiumEntry(category: NativeCompendiumCategory, value: unknown): unknown {
  return CATEGORY_SCHEMAS[category].parse(value);
}

export function isGrandCompendiumEntry(category: string, value: unknown): boolean {
  return category in CATEGORY_SCHEMAS
    && CATEGORY_SCHEMAS[category as NativeCompendiumCategory].safeParse(value).success;
}

export function formatGrandCompendiumIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path =
        issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}
