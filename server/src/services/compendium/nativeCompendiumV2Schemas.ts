import { z, ZodError } from "zod";
import { MonsterSchema } from "./nativeCompendiumV2Schemas.monster.js";
import { ItemSchema } from "./nativeCompendiumV2Schemas.item.js";
import { SpellSchema } from "./nativeCompendiumV2Schemas.spell.js";
import { ClassSchema } from "./nativeCompendiumV2Schemas.class.js";
import { SpeciesSchema } from "./nativeCompendiumV2Schemas.species.js";
import { BackgroundSchema } from "./nativeCompendiumV2Schemas.background.js";
import { FeatSchema } from "./nativeCompendiumV2Schemas.feat.js";
import { DeckSchema, BastionSchema } from "./nativeCompendiumV2Schemas.misc.js";

export type { NativeCompendiumCategory } from "./nativeCompendiumV2Schemas.shared.js";
export { CANONICAL_V2_SCHEMA_VERSION } from "./nativeCompendiumV2Schemas.shared.js";
export { MonsterSchema } from "./nativeCompendiumV2Schemas.monster.js";
export { ItemSchema } from "./nativeCompendiumV2Schemas.item.js";
export { SpellSchema } from "./nativeCompendiumV2Schemas.spell.js";
export { ClassSchema, ClassToolProficiencySchema } from "./nativeCompendiumV2Schemas.class.js";
export type { ClassToolProficiency } from "./nativeCompendiumV2Schemas.class.js";
export { SpeciesSchema } from "./nativeCompendiumV2Schemas.species.js";
export { BackgroundSchema } from "./nativeCompendiumV2Schemas.background.js";
export { FeatSchema } from "./nativeCompendiumV2Schemas.feat.js";
export { DeckSchema, BastionSchema } from "./nativeCompendiumV2Schemas.misc.js";

import type { NativeCompendiumCategory } from "./nativeCompendiumV2Schemas.shared.js";

export const CATEGORY_SCHEMAS: Record<NativeCompendiumCategory, z.ZodTypeAny> = {
  monsters: MonsterSchema,
  items: ItemSchema,
  spells: SpellSchema,
  classes: ClassSchema,
  species: SpeciesSchema,
  backgrounds: BackgroundSchema,
  feats: FeatSchema,
  decks: DeckSchema,
  bastions: BastionSchema,
};

export function parseCanonicalV2Entry(category: NativeCompendiumCategory, value: unknown): unknown {
  return CATEGORY_SCHEMAS[category].parse(value);
}

export function formatCanonicalV2Issues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path =
        issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("\n");
}
