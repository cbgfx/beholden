import { z } from "zod";
import { AttackOverrideSchema, ConditionInstanceSchema, OverridesSchema } from "../../lib/schemas.js";

// MARK: - Campaign Export v3 Contract
/**
 * The one campaign document shape the importer understands. Older exports are converted to this
 * shape by `migrateCampaignDocument` (./migrate.ts) before they reach this schema, so there is a
 * single reader instead of one per historical version.
 *
 * Every value the importer stores is typed here: a wrong type is rejected instead of being coerced
 * (e.g. the string "false" is no longer read as `true`). Missing optional values fall back to the
 * same defaults the app uses when it creates the row. Unknown keys are dropped, which covers
 * read-only fields the exporter includes for convenience (campaignId, titleIsDerived, activeIndex...).
 */
export const CAMPAIGN_EXPORT_FORMAT = "beholden.campaign";
export const CAMPAIGN_EXPORT_VERSION = 3;

const Id = z.string().trim().min(1).max(200);
const Timestamp = z.number().int().nonnegative();
const Timestamps = { createdAt: Timestamp.optional(), updatedAt: Timestamp.optional() };
const Int = z.number().int();
const NullableText = z.string().nullable();

/** v3 collections are objects keyed by the entry id (what the exporter writes). */
const collection = <T extends z.ZodTypeAny>(entry: T) => z.record(z.string(), entry).default({});

const DeathSaves = z.object({ success: Int.min(0).max(3), fail: Int.min(0).max(3) });
const Conditions = z.array(ConditionInstanceSchema).max(100);

const Campaign = z.object({
  id: Id,
  name: z.string().default(""),
  color: NullableText.default(null),
  ruleset: z.enum(["5e", "5.5e"]).default("5.5e"),
  imageUrl: NullableText.default(null),
  sharedNotes: z.string().default(""),
  // Left undefined when absent so the importer can keep the value already stored locally.
  campaignStory: NullableText.optional(),
  campaignNotes: NullableText.optional(),
  isActive: z.boolean().default(true),
  binderId: Id.nullable().default(null),
  currentDate: z.object({ text: NullableText, sort: Int.nullable() }).nullable().default(null),
  partyCurrency: z.object({
    PP: Int.nonnegative(), GP: Int.nonnegative(), SP: Int.nonnegative(), CP: Int.nonnegative(),
  }).optional(),
  ...Timestamps,
});

const Adventure = z.object({
  id: Id,
  name: z.string().default(""),
  status: z.string().default("active"),
  sort: Int.default(0),
  ...Timestamps,
});

const Encounter = z.object({
  id: Id,
  adventureId: Id.nullable().default(null),
  name: z.string().default(""),
  status: z.string().default("Open"),
  sort: Int.default(0),
  combat: z.object({ round: Int.min(1), activeCombatantId: Id.nullable().default(null) }).optional(),
  xpAwardedAt: Timestamp.nullable().default(null),
  ...Timestamps,
});

const AbilityScore = Int.min(1).max(30).optional();
const Player = z.object({
  id: Id,
  userId: Id.nullable().default(null),
  characterId: Id.nullable().default(null),
  playerName: z.string().default(""),
  characterName: z.string().default(""),
  class: z.string().default(""),
  species: z.string().default(""),
  level: Int.min(1).max(20).default(1),
  hpMax: Int.nonnegative().default(10),
  hpCurrent: Int.nonnegative().default(10),
  ac: Int.default(10),
  // `speed` is the condition-adjusted value shown in play; `baseSpeed` is the stored value.
  speed: Int.nonnegative().optional(),
  baseSpeed: Int.nonnegative().optional(),
  str: AbilityScore, dex: AbilityScore, con: AbilityScore,
  int: AbilityScore, wis: AbilityScore, cha: AbilityScore,
  color: NullableText.optional(),
  syncedAc: Int.optional(),
  imageUrl: NullableText.default(null),
  overrides: OverridesSchema.optional(),
  conditions: Conditions.default([]),
  deathSaves: DeathSaves.optional(),
  sharedNotes: z.string().default(""),
  ...Timestamps,
});

const INpc = z.object({
  id: Id,
  monsterId: z.string().nullable().default(null),
  binderMortalId: Id.nullable().default(null),
  name: z.string().default(""),
  label: NullableText.default(null),
  friendly: z.boolean().default(false),
  hpMax: Int.default(1),
  hpCurrent: Int.default(1),
  hpDetails: NullableText.default(null),
  ac: Int.default(10),
  acDetails: NullableText.default(null),
  sort: Int.nullable().default(null),
  ...Timestamps,
});

const Note = z.object({
  id: Id,
  adventureId: Id.nullable().default(null),
  title: z.string().default(""),
  text: z.string().default(""),
  sort: Int.default(0),
  ...Timestamps,
});

const Treasure = z.object({
  id: Id,
  adventureId: Id.nullable().default(null),
  encounterId: Id.nullable().default(null),
  source: z.enum(["compendium", "custom"]).default("compendium"),
  itemId: NullableText.default(null),
  name: z.string().default("New Item"),
  rarity: NullableText.default(null),
  type: NullableText.default(null),
  type_key: NullableText.default(null),
  attunement: z.boolean().default(false),
  magic: z.boolean().default(false),
  text: z.string().default(""),
  qty: Int.min(1).default(1),
  sort: Int.default(0),
  ...Timestamps,
});

const PartyInventoryItem = z.object({
  id: Id,
  name: z.string().default("New Item"),
  quantity: Int.nonnegative().default(1),
  weight: z.number().nonnegative().nullable().default(null),
  notes: z.string().default(""),
  source: NullableText.default(null),
  itemId: NullableText.default(null),
  rarity: NullableText.default(null),
  type: NullableText.default(null),
  description: NullableText.default(null),
  payload: z.record(z.string(), z.unknown()).nullable().default(null),
  sort: Int.default(0),
  ...Timestamps,
});

const Condition = z.object({
  id: Id,
  key: z.string().default(""),
  name: z.string().default(""),
  description: NullableText.default(null),
  sort: Int.nullable().default(null),
  ...Timestamps,
});

const Bastion = z.object({
  id: Id,
  name: z.string().default("Bastion"),
  active: z.boolean().default(false),
  walled: z.boolean().default(false),
  defendersArmed: Int.nonnegative().default(0),
  defendersUnarmed: Int.nonnegative().default(0),
  assignedPlayerIds: z.array(Id).default([]),
  assignedCharacterIds: z.array(Id).default([]),
  notes: z.string().default(""),
  maintainOrder: z.boolean().default(false),
  facilities: z.array(z.unknown()).default([]),
  ...Timestamps,
});

const Combatant = z.object({
  id: Id.optional(),
  baseType: z.enum(["player", "monster", "inpc", "world"]).default("monster"),
  baseId: z.string().default(""),
  baseRuleset: z.enum(["5e", "5.5e"]).optional(),
  name: z.string().default(""),
  label: z.string().default(""),
  initiative: z.number().nullable().default(null),
  friendly: z.boolean().default(false),
  color: z.string().default("#cccccc"),
  hpCurrent: Int.nullable().default(null),
  hpMax: Int.nullable().default(null),
  hpDetails: NullableText.default(null),
  ac: Int.nullable().default(null),
  acDetails: NullableText.default(null),
  sort: Int.optional(),
  usedReaction: z.boolean().default(false),
  usedLegendaryActions: Int.nonnegative().default(0),
  usedLegendaryResistances: Int.nonnegative().default(0),
  overrides: OverridesSchema.optional(),
  conditions: Conditions.default([]),
  deathSaves: DeathSaves.optional(),
  usedSpellSlots: z.record(z.string(), Int.nonnegative()).default({}),
  attackOverrides: AttackOverrideSchema.default(null),
  engagedWithPlayers: z.boolean().optional(),
  description: z.string().optional(),
  ...Timestamps,
});

const Combat = z.object({
  encounterId: Id,
  round: Int.min(1).default(1),
  activeCombatantId: Id.nullable().default(null),
  combatants: z.array(Combatant).default([]),
  ...Timestamps,
});

export const CampaignDocumentV3Schema = z.object({
  format: z.literal(CAMPAIGN_EXPORT_FORMAT),
  version: z.literal(CAMPAIGN_EXPORT_VERSION),
  exportedAt: z.iso.datetime().optional(),
  campaign: Campaign,
  adventures: collection(Adventure),
  encounters: collection(Encounter),
  players: collection(Player),
  inpcs: collection(INpc),
  notes: collection(Note),
  partyInventory: collection(PartyInventoryItem),
  treasure: collection(Treasure),
  conditions: collection(Condition),
  bastions: collection(Bastion),
  // Keyed by encounter id rather than by an id of its own.
  combats: collection(Combat),
}).superRefine((doc, ctx) => {
  // Reference topology is checked here, before the importer opens its write transaction.
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });

  const collections = ["adventures", "encounters", "players", "inpcs", "notes", "partyInventory", "treasure", "conditions", "bastions"] as const;
  for (const name of collections) {
    for (const [key, entry] of Object.entries(doc[name])) {
      if (entry.id !== key) issue([name, key, "id"], `${name} entry is keyed "${key}" but has id "${entry.id}".`);
    }
  }
  for (const [key, combat] of Object.entries(doc.combats)) {
    if (combat.encounterId !== key) issue(["combats", key, "encounterId"], `Combat is keyed "${key}" but belongs to encounter "${combat.encounterId}".`);
    if (!doc.encounters[combat.encounterId]) issue(["combats", key], "Combat references an encounter outside this import.");
  }
  for (const [key, encounter] of Object.entries(doc.encounters)) {
    if (encounter.adventureId && !doc.adventures[encounter.adventureId]) issue(["encounters", key, "adventureId"], "Encounter references an adventure outside this import.");
  }
  for (const [key, note] of Object.entries(doc.notes)) {
    if (note.adventureId && !doc.adventures[note.adventureId]) issue(["notes", key, "adventureId"], "Note references an adventure outside this import.");
  }
  for (const [key, entry] of Object.entries(doc.treasure)) {
    if (entry.adventureId && !doc.adventures[entry.adventureId]) issue(["treasure", key, "adventureId"], "Treasure references an adventure outside this import.");
    if (entry.encounterId && !doc.encounters[entry.encounterId]) issue(["treasure", key, "encounterId"], "Treasure references an encounter outside this import.");
  }
});

export type CampaignDocumentV3 = z.infer<typeof CampaignDocumentV3Schema>;
