# Grand Compendium Schema Reference

This is the exhaustive authoring reference for Beholden's current Grand Compendium entry schemas. It is derived from the Zod schemas in `server/src/services/compendium/grandCompendiumSchemas*.ts` and the structured-effect runtime contract in `web-player/src/domain/character/featureEffects.ts`.

Use `BEHOLDEN_AI_CONTENT_GUIDE.md` for workflow, design guidance, and complete examples. Use this file to answer: **which fields exist, which are required, what shape do they have, and what exact closed values are accepted?**

## Notation

- `field: type` means the field is required.
- `field?: type` means the field is optional and should normally be omitted when empty, false, null, or inapplicable.
- `A | B` means either shape/value is accepted.
- `literal true` means `true` is accepted and `false` is not; omit the field for false.
- Unless a shape explicitly says otherwise, objects are strict and unknown fields fail validation.
- `nonnegative integer` means an integer at least 0; `positive integer` means an integer at least 1.
- Every entry requires `ruleset: "5e" | "5.5e"`.

## Compendium document envelope

```text
{
  format: "beholden.compendium"
  schema: "grand"
  exportedAt?: string
  monsters?: Monster[]
  items?: Item[]
  spells?: Spell[]
  classTalents?: ClassTalent[]
  classes?: Class[]
  species?: Species[]
  backgrounds?: Background[]
  feats?: Feat[]
  decks?: DeckCard[]
  bastions?: BastionEntry[]
}
```

Only `decks` and `bastions` entries contain `schemaVersion: 2`. Other entries must omit it.

## Shared closed values

```text
Ruleset       = "5e" | "5.5e"
Ability       = "str" | "dex" | "con" | "int" | "wis" | "cha"
Size          = "T" | "S" | "M" | "L" | "H" | "G"
Recovery      = "short_rest" | "long_rest"
Resolution    = "automatic" | "manual" | "mixed"
```

Size meanings are Tiny, Small, Medium, Large, Huge, and Gargantuan.

---

# Item

## Complete shape

```text
Item = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  type: non-empty string
  rarity: non-empty string
  magical?: true
  attunement?: true | non-empty string
  equippable?: true
  weight?: number >= 0
  value?: number >= 0
  proficiency?: non-empty string
  ammo?: AmmoFamily
  usage?: "held"
  bundle?: ItemBundle
  container?: true
  ignoreWeight?: true
  effects?: StructuredEffect[]                 // at least 1
  uses?: ItemUses
  spells?: { [spellId matching /^s_/]: ItemSpellAccess }
  spellcasting?: "character" | ItemSpellcastingStats
  spellTemplate?: ItemSpellTemplate | ItemSpellTemplate[] // array has at least 2
  armor?: ItemArmor
  weapon?: ItemWeapon
  detail?: non-empty string
  modifiers?: ItemModifier[]                   // at least 1
  rolls?: ItemRoll[]                           // at least 1
  description: string | string[]               // array has at least 1
}
```

Validation relationships:

- An item cannot contain both `weapon` and `armor`.
- Top-level `ammo` requires `type: "Ammo"` exactly.
- `weapon.ammo` requires `weapon.properties` to contain `"A"`.
- `ignoreWeight: true` requires `container: true`.
- Empty nested objects and arrays are rejected where marked.

`type` and `rarity` are currently non-empty strings, not schema enums. Recommended canonical values are:

```text
type = "Light Armor" | "Medium Armor" | "Heavy Armor" | "Shield" |
       "Melee Weapon" | "Ranged Weapon" | "Ammo" | "Potion" | "Scroll" |
       "Wand" | "Rod" | "Staff" | "Ring" | "Wondrous Item" |
       "Adventuring Gear" | "Currency" | "Other"

rarity = "common" | "uncommon" | "rare" | "very rare" | "legendary" |
         "artifact" | "varies" | "unknown"
```

The recommendations above are UI/catalog conventions; validation accepts any non-empty string.

## Armor, weapon, modifiers, and rolls

```text
ItemArmor = {
  ac?: nonnegative integer
  stealthDisadvantage?: true
  strength?: nonnegative integer
}

ItemWeapon = {
  damage?: non-empty string
  twoHandedDamage?: non-empty string
  damageType?: non-empty string
  range?: non-empty string
  properties?: non-empty string[]
  mastery?: "Cleave" | "Graze" | "Nick" | "Push" | "Sap" | "Slow" | "Topple" | "Vex"
  ammo?: AmmoFamily
}

AmmoFamily = "arrow" | "bolt" | "energy-cell" | "firearm-bullet" |
             "needle" | "sling-bullet"

ItemModifier = {
  target: "ac" | "melee_attacks" | "melee_damage" | "ranged_attacks" |
          "ranged_damage" | "weapon_attacks" | "weapon_damage" |
          "saving_throws" | "ability_checks" | "spell_attack" |
          "spell_save_dc" | "initiative" | "proficiency_bonus"
  amount: nonzero integer
}

ItemRoll = {
  formula: non-empty string
  description?: non-empty string
}
```

Recommended weapon property codes:

```text
"A" Ammunition                 "AF" Ammunition (Firearm)
"BF" Burst Fire                "F"  Finesse
"H" Heavy                     "L"  Light
"LD" Loading                  "M"  Martial
"R" Reach                     "RC" Reload
"S" Special                   "T"  Thrown
"V" Versatile                 "2H" Two-Handed
```

`weapon.properties` and `weapon.damageType` are strings at schema level. Recommended damage codes are `A`, `B`, `C`, `F`, `FC`, `L`, `N`, `P`, `PS`, `PY`, `R`, `S`, and `T`.

## Charges and depletion

```text
UseAmount = positive integer | dice string matching /^\d+d\d+(?:\+\d+)?$/

ItemUses = UseAmount | {
  max: UseAmount
  recover?: false | UseAmount
  depletion?: "destroy" | "mundane" | "loseProperties" | DepletionRoll
}

DepletionRoll = {
  destroy?: true | integer 1..20
  mundane?: true | integer 1..20
  loseProperties?: true | integer 1..20
  regain?: { [d20 result "1".."20"]: UseAmount }
}
```

The object form of `ItemUses` must contain `recover` or `depletion`. `DepletionRoll` must contain at least one field.

## Item spell access

```text
SpellCost = nonnegative integer | "level"

Item.spells = {
  [spellId matching /^s_/]: SpellCost | {
    cost?: SpellCost
    level?: integer 0..9
    uses?: UseAmount
    consume?: true
    maxLevel?: integer 0..9
    maxCost?: nonnegative integer
    upcast?: positive integer
    dc?: nonnegative integer
    attack?: integer
    note?: non-empty string
  }
}

ItemSpellcastingStats = {
  dc?: nonnegative integer
  attack?: integer
}
```

The object spell-access form must contain at least one field. `ItemSpellcastingStats` must contain `dc` or `attack`.

## Item spell templates

```text
BoundSpellTemplate = {
  kind: "bound"
  level?: integer 0..9
  minLevel?: integer 0..9
  maxLevel?: integer 0..9
  list?: non-empty string
  schools?: non-empty string[]
  cost?: SpellCost
  uses?: positive integer
  consume?: true
  prepared?: true
  dc?: nonnegative integer
  attack?: integer
  stats?: { [spell level "0".."9"]: { dc?: nonnegative integer, attack?: integer } }
}

StoredSpellTemplate = {
  kind: "stored"
  capacity: positive integer
  minLevel?: integer 0..9
  maxLevel?: integer 0..9
  initial?: non-empty string
}

ChoiceSpellTemplate = {
  kind: "choice"
  list: non-empty string
  level?: integer 0..9
  minLevel?: integer 0..9
  maxLevel?: integer 0..9
  uses?: positive integer
  recovery?: "short_rest" | "long_rest"
}

RandomSpellTemplate = {
  kind: "random"
  die: "1d4" | "1d6" | "1d8" | "1d10" | "1d12" | "1d20" | "1d100"
  when?: non-empty string
  outcomes: {
    [result or range matching /^\d+(?:-\d+)?$/]:
      spellId matching /^s_/ |
      { id: spellId matching /^s_/, level?: integer 0..9, note?: non-empty string }
  }
}
```

## Bundles and containers

```text
ItemBundle = {
  container: itemId matching /^i_/
  items: { [itemId matching /^i_/]: positive integer }
}
```

`items` must not be empty and must not repeat the `container` ID.

---

# Monster

## Complete shape

```text
Monster = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  classification?: MonsterClassification
  description?: non-empty string
  initiativeBonus?: integer
  passivePerception?: nonnegative integer
  npc?: true
  challenge?: { rating?: non-empty string, xp?: number >= 0 }
  armorClass?: { value: positive integer, source?: non-empty string }
  hitPoints?: { average?: positive integer, formula?: non-empty string }
  movement?: MonsterMovement
  abilities?: PartialAbilityScores
  proficiencies?: MonsterProficiencies
  defenses?: MonsterDefenses
  senses?: non-empty string[]
  languages?: non-empty string[]
  treasure?: non-empty string
  traits?: MonsterAction[]
  actions?: MonsterAction[]
  reactions?: MonsterAction[]
  legendaryActions?: MonsterAction[]
  legendaryUses?: positive integer
  lair?: { name: non-empty string, description: non-empty string }[]
  spellcasting?: MonsterAction[]
  spells?: { id: non-empty string, level?: integer 1..9 }[]
}
```

`hitPoints` must contain `average` or `formula`. `legendaryActions` and `legendaryUses` must either both exist or both be omitted. Action IDs must be unique within each action group.

## Classification and statistics

```text
MonsterClassification = {
  size?: Size
  type?: non-empty string
  description?: non-empty string
  sortName?: non-empty string
  alignment?: non-empty string
  ancestry?: non-empty string
  environment?: non-empty string[]
}

MonsterMovement = {
  walk?: nonnegative integer
  burrow?: nonnegative integer
  climb?: nonnegative integer
  fly?: nonnegative integer
  swim?: nonnegative integer
  hover?: true
}

PartialAbilityScores = {
  str?: integer 1..30
  dex?: integer 1..30
  con?: integer 1..30
  int?: integer 1..30
  wis?: integer 1..30
  cha?: integer 1..30
}

NamedBonus = { name: non-empty string, bonus?: number }

MonsterProficiencies = {
  savingThrows?: NamedBonus[]
  skills?: NamedBonus[]
}

MonsterDefenses = {
  vulnerabilities?: non-empty string[]
  resistances?: non-empty string[]
  damageImmunities?: non-empty string[]
  conditionImmunities?: non-empty string[]
}
```

Every optional object above must contain at least one field.

## Traits, actions, reactions, spellcasting, and legendary actions

All five arrays use the same shape:

```text
MonsterAction = {
  id: non-empty string
  name: non-empty string
  description: string
  recharge?: MonsterRecharge
  spellSlots?: { [slot label]: nonnegative integer }
  attack?: MonsterAttack
  damage?: DamageComponent | DamageComponent[] // array has at least 2
  routine?: RoutineStep[]
  replace?: Replacement
  area?: "cone" | "line" | "sphere" | "cube" | "emanation"
  targets?: integer >= 2
}

MonsterRecharge =
  { roll: integer 1..6 } |
  { uses: positive integer, period: "day" | "turn" } |
  { period: "short_rest" | "long_rest" }

MonsterAttack = {
  toHit: number
  reach?: non-empty string
  range?: non-empty string
  melee?: true
  ranged?: true
}

DamageComponent = {
  roll: non-empty string
  type: non-empty string | non-empty string[] // array has at least 2
}

RoutineStep = {
  use?: non-empty action ID
  choose?: non-empty action ID[] // at least 2
  count?: integer >= 2
  optional?: true
}

Replacement = {
  count?: integer >= 2
  with: non-empty action ID[]
}
```

Each routine step requires exactly one of `use` and `choose`. `area` and `targets` are mutually exclusive. Routine and replacement references must target another ID in the monster's `actions` array and cannot reference themselves.

---

# Spell

```text
Spell = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  level?: integer 0..9
  school?: SpellSchool
  casting?: SpellCasting
  ritual?: true
  access?: spell-list ID[] matching /^sl_[a-z0-9_]+$/
  check?: SpellCheck | SpellCheck[] // array has at least 2
  rolls?: SpellRoll[]
  description: non-empty string[]
}

SpellSchool = "Abjuration" | "Conjuration" | "Divination" | "Enchantment" |
              "Evocation" | "Illusion" | "Necromancy" | "Transmutation"

SpellCheck = "attack" | "str" | "dex" | "con" | "int" | "wis" | "cha"

SpellCasting = {
  time?: non-empty string
  range?: non-empty string
  components?: SpellComponents
  duration?: SpellDuration
}

SpellComponents = {
  verbal?: true
  somatic?: true
  material?: true | non-empty string
}

SpellDuration = {
  description?: non-empty string
  concentration?: true
}

SpellRoll = {
  formula: non-empty string
  effect?: SpellRollEffect | DamageSpellRollEffect[] // damage array has at least 2
  description?: non-empty string
  level?: integer 0..20
}

SpellRollEffect = DamageSpellRollEffect | "healing" | "temp_hp"

DamageSpellRollEffect = "acid" | "bludgeoning" | "cold" | "fire" | "force" |
                        "lightning" | "necrotic" | "piercing" | "poison" |
                        "psychic" | "radiant" | "slashing" | "thunder"
```

Empty `casting`, `components`, and `duration` objects are rejected. A roll's `level` means character-level tier for a cantrip and slot level for a leveled spell.

---

# Class talent

```text
ClassTalent = {
  id: string matching /^ct_[a-z0-9_]+$/
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  kind: "invocation" | "maneuver" | "metamagic"
  prerequisite?: {
    level?: integer 1..20
    talent?: class-talent ID matching /^ct_[a-z0-9_]+$/
    cantrip?: "damage" | "attack_damage"
  }
  repeatable?: true
  effects?: StructuredEffect[]
  rolls?: { formula: non-empty string, description?: non-empty string }[]
  description: non-empty string[]
}
```

An existing `prerequisite` object must contain at least one field.

---

# Class

## Complete top-level shape

```text
Class = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  description: string
  descriptions?: non-empty string[]
  hitDie?: positive integer
  startingWealth?: number >= 0
  primaryAbility?: AbilityRequirement
  equipment?: Equipment
  multiclass?: MulticlassGrants
  subclasses?: SubclassRegistry
  choices?: ClassChoice[]
  spellLists?: { [ID matching /^sl_[a-z0-9_]+$/]: non-empty display name }
  proficiencies: ClassProficiencies
  spellcasting?: ClassSpellcasting
  levels: ClassLevel[]
}

AbilityRequirement = Ability |
  { any: Ability[] } |  // at least 2
  { all: Ability[] }    // at least 2
```

Class level numbers must be unique.

## Proficiencies, tools, multiclassing, and spellcasting

```text
ClassProficiencies = {
  savingThrows: Ability[]
  skills: { choose: nonnegative integer, from: string[] }
  armor: string[]
  weapons: string[]
  tools?: ToolProficiencies
}

ToolProficiencies = {
  fixed?: non-empty string[]
  choices?: { count: positive integer, from: string[] }[]
  notes?: non-empty string[]
}

MulticlassGrants = {
  skills?: { choose: positive integer, from?: string[] }
  armor?: non-empty string[]
  weapons?: non-empty string[]
  tools?: ToolProficiencies
}

ClassSpellcasting = {
  ability?: Ability
  list?: spell-list ID matching /^sl_[a-z0-9_]+$/
  slotRecovery?: "short_rest" | "long_rest"
  preparedSpellChanges?: "short_rest" | "long_rest"
}
```

An existing `tools` or `multiclass` object must not be empty.

## Levels, resources, and features

```text
ClassLevel = {
  level: integer 1..20
  abilityScoreImprovement?: true
  cantripsKnown?: nonnegative integer
  spellsPrepared?: nonnegative integer
  spellSlots?: { [spell-level label]: nonnegative integer }
  features?: ClassFeature[]
  resources?: ClassResource[]
}

ClassResource = {
  name: non-empty string
  uses: nonnegative integer
  recovery?: "short_rest" | "long_rest"
  subclass?: subclass ID matching /^sc_[a-z0-9_]+$/
}

ClassFeature = {
  id?: non-empty string
  name: non-empty string
  description: string
  source?: non-empty string
  subclass?: subclass ID matching /^sc_[a-z0-9_]+$/
  talent?: {
    kind: "invocation" | "maneuver" | "metamagic"
    known: { [character level "1".."20"]: positive integer }
    replace?: true
    ability?: Ability[] // at least 2
  }
  choices?: ClassFeatureChoice[]
  noteTemplate?: {
    id: string matching /^nt_[a-z0-9_]+$/
    title: non-empty string
    text: non-empty string
  }
  effects?: StructuredEffect[]
  scalingRolls?: ScalingRoll[]
  preparedSpellProgression?: PreparedSpellProgression[]
  resolution?: Resolution
  resolutionNotes?: non-empty string[]
}
```

Feature IDs are unique across the class. Note-template IDs are unique across the class. Every feature/resource `subclass` must exist in `subclasses.options`.

## Feature choices

```text
FeatFeatureChoice = {
  kind: "feat"
  category: "F"
  count?: positive integer
  replace?: true
}

WeaponMasteryFeatureChoice = {
  kind: "weapon_mastery"
  known: { [character level "1".."20"]: positive integer }
  melee?: true
}

ExpertiseFeatureChoice = {
  kind: "expertise"
  known: { [character level "1".."20"]: positive integer }
  from?: non-empty string[]
}

ProficiencyFeatureChoice = {
  kind: "proficiency"
  category: "skill" | "tool" | "language" | "saving_throw"
  count: positive integer
  from?: "class_skills" | "artisan_tools" | non-empty string[]
  ifProficient?: non-empty string
}

SpellFeatureChoice = {
  id: string matching /^fc_[a-z0-9_]+$/
  kind: "spell"
  lists: spell-list ID[] matching /^sl_[a-z0-9_]+$/
  count?: positive integer
  level?: integer 0..9
  maxLevel?: integer 0..9
  school?: non-empty string
  mode: "known" | "prepared" | "spellbook"
  replace?: true
  perNewSlotLevel?: true
  freeCast?: true
  ifKnown?: non-empty string
}
```

`level` and `maxLevel` are mutually exclusive.

## Subclasses and class-level option groups

```text
SubclassRegistry = {
  level: integer 1..20
  options: {
    [subclass ID matching /^sc_[a-z0-9_]+$/]:
      non-empty subclass name |
      {
        name: non-empty string
        spellcasting?: {
          ability: Ability
          list: spell-list ID matching /^sl_[a-z0-9_]+$/
          progression?: SubclassSpellcastingRow[]
        }
      }
  }
}

SubclassSpellcastingRow = {
  level: integer 1..20
  cantrips?: nonnegative integer
  prepared?: nonnegative integer
  slots?: nonnegative integer[] // 1..9 entries; trailing zeroes omitted
}

ClassChoice = {
  id: string matching /^cc_[a-z0-9_]+$/
  name: non-empty string
  options: {                        // at least 2
    id: string matching /^cco_[a-z0-9_]+$/
    name: non-empty string
    features: non-empty feature ID[]
  }[]
}
```

Subclass progression rows must be non-empty and have unique levels. Class choice IDs and their option IDs must be unique; referenced feature IDs must exist.

---

# Species

```text
Species = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  size?: Size
  speed: nonnegative integer
  creatureType?: non-empty string
  spellcastingAbility?: Ability
  choices?: SpeciesChoices
  traits: Trait[]
}

SpeciesChoices = {
  hasChosenSize?: true
  skillChoice?: { count: nonnegative integer, from: string[] | null }
  toolChoice?: { count: nonnegative integer, from: string[] | null }
  languageChoice?: { count: nonnegative integer, from: string[] | null }
  hasFeatChoice?: true
  spellcastingAbilityChoice?: { options: Ability[] } // at least 2
}
```

An existing `choices` object must not be empty. `creatureType` should be omitted for the Humanoid default.

## Shared trait shape

Species and backgrounds share this trait contract:

```text
Trait = {
  id: non-empty string
  name: non-empty string
  description: string
  category?: non-empty string
  scalingRolls?: ScalingRoll[]
  preparedSpellProgression?: PreparedSpellProgression[]
  effects?: StructuredEffect[]
  resolution?: Resolution
  resolutionNotes?: non-empty string[]
}

ScalingRoll = {
  description?: non-empty string
  level?: integer 1..20
  formula: non-empty string
}

PreparedSpellProgression = {
  label: string | null
  levelLabel: string
  spellLabel: string
  rows: { level: integer 1..20, spells: string[] }[]
  choiceGroupKey?: string | null
  choicePrompt?: string | null
  choiceOptionLabel?: string | null
  choiceOptions?: string[] | null
}
```

---

# Background

```text
Background = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  description: string
  proficiencies: {
    skills?: CompactChoice
    tools?: CompactChoice
    languages?: CompactChoice
    feat?: feat ID matching /^f_[a-z0-9_:'()]+$/
    featChoice?: positive integer | {
      count: positive integer
      from: feat ID[] matching /^f_[a-z0-9_:'()]+$/ // at least 2
    }
    abilityScores?: non-empty string[]
    abilityScoreChoose?: positive integer
  }
  equipment?: Equipment
  traits?: Trait[]
}

CompactChoice = non-empty string[] | {
  fixed?: non-empty string[]
  choose: positive integer
  from?: non-empty string[]
}
```

## Equipment

The same equipment shape is used by backgrounds and classes.

```text
Equipment = {
  description?: non-empty string
  options?: EquipmentOption[]
}

EquipmentOption = {
  id: non-empty string
  entries: EquipmentEntry[]
}

EquipmentEntry =
  { kind: "item", itemId: ID matching /^[a-z0-9_]+$/, quantity: positive integer,
    sourceLabel?: non-empty string } |
  { kind: "choiceRef", choiceKey: "background.tools" | "class.tools",
    quantity: positive integer, sourceLabel: non-empty string } |
  { kind: "itemChoice", choiceKey: non-empty string,
    itemIds: ID[] matching /^[a-z0-9_]+$/, quantity: positive integer,
    sourceLabel: non-empty string } |
  { kind: "currency", denomination: "PP" | "GP" | "EP" | "SP" | "CP",
    amount: nonnegative integer }
```

`Equipment` requires `description` or at least one option. `itemChoice.itemIds` requires at least two IDs.

---

# Feat

## Complete shape and prerequisites

```text
Feat = {
  id: non-empty string
  ruleset: Ruleset
  name: non-empty string
  source?: non-empty string
  category?: "O" | "E" | "F"
  prerequisite?: FeatPrerequisite
  repeatable?: true
  description: string
  resolution?: Resolution
  resolutionNotes?: non-empty string[]
  mechanics?: FeatMechanics
}
```

Category codes are Origin (`O`), Epic Boon (`E`), and Fighting Style (`F`). General is the default and is omitted.

```text
FeatPrerequisite = integer 1..20 | {
  level?: integer 1..20
  ability?: AbilityPrerequisite | AbilityPrerequisite[] // array at least 2
  class?: "paladin"
  feature?: "spellcasting" | "fighting_style"
  training?: Training
  feat?: feat ID matching /^f_/
  anyOfFeats?: feat ID[] matching /^f_/
  noneOfFeats?: feat ID[] matching /^f_/
  campaign?: "eberron"
  any?: PrerequisiteAlternative[] // at least 2
}

AbilityPrerequisite = {
  any: Ability[]
  min?: integer 1..30 // 13 is the omitted default
}

Training = "martial_weapon" | "heavy_weapon" | "light_armor" |
           "medium_armor" | "heavy_armor" | "shield"

PrerequisiteAlternative =
  { feat: feat ID matching /^f_/ } |
  { feature: "spellcasting" | "fighting_style" } |
  { training: Training }
```

## Feat mechanics

```text
FeatMechanics = {
  resolution?: Resolution
  resolutionNotes?: non-empty string[]
  category?: non-empty string
  prerequisite?: non-empty string
  repeatable?: true
  source?: non-empty string
  grants?: FeatGrants
  choices?: FeatChoice[]
  uses?: FeatUse[]
  preparedSpellProgression?: PreparedSpellProgression[]
  rolls?: { description?: non-empty string, formula: non-empty string }[]
  spellcastingAbility?: Ability
  spellcastingAbilityFromChoiceId?: non-empty string
}

FeatGrants = {
  skills?: string[]
  tools?: string[]
  languages?: string[]
  armor?: string[]
  weapons?: string[]
  savingThrows?: string[]
  spells?: string[]
  cantrips?: string[]
  abilityIncreases?: { [ability name]: number }
  bonuses?: { target: string, value: number }[]
  effects?: StructuredEffect[]
}

FeatUse = {
  count: nonnegative integer
  countFrom?: "proficiency_bonus" | "ability_modifier"
  ability?: non-empty string
  minimum?: number
  recharge?: "short_rest" | "short_or_long_rest" // long rest is omitted default
  note: string
  grantsSpell?: non-empty spell ID/name
  grantsChoiceId?: non-empty choice ID
}
```

`grantsSpell` and `grantsChoiceId` are mutually exclusive.

## Feat choices

```text
FeatChoice = {
  id: string
  type: "proficiency" | "expertise" | "ability_score" | "spell" |
        "spell_list" | "weapon_mastery" | "damage_type" |
        "spellcasting_ability"
  count: nonnegative integer
  countFrom?: "proficiency_bonus"
  options?: non-empty string[]
  anyOf?: string[]
  amount?: number
  split?: true
  maximum?: integer 1..30
  level?: integer
  maxLevel?: integer 1..9
  ritual?: true
  linkedTo?: non-empty string
  dependsOnChoiceId?: non-empty string
  dependencyKind?: "spell_list" | "ability_score" | "replacement"
  replacementFor?: non-empty string
  distinct?: true
  note?: non-empty string
}
```

For spell choices, `level` means exactly that level and `maxLevel` means at or below that level; do not use both.

---

# Deck card

```text
DeckCard = {
  schemaVersion: 2
  ruleset: Ruleset
  id: non-empty string
  deckName: non-empty string
  deckKey: non-empty string
  cardName: non-empty string
  cardKey: non-empty string
  text: string
  sort: integer
}
```

---

# Bastion

```text
BastionSpace = {
  schemaVersion: 2
  ruleset: Ruleset
  kind: "space"
  id: non-empty string
  name: non-empty string
  squares: integer >= 1
  sort: integer
  nameKey?: non-empty string
  label?: string | null
  minimumLevel?: integer 1..20
}

BastionOrder = {
  schemaVersion: 2
  ruleset: Ruleset
  kind: "order"
  id: non-empty string
  name: non-empty string
  sort: integer
  nameKey?: non-empty string
  label?: string | null
  minimumLevel?: integer 1..20
}

BastionFacility = {
  schemaVersion: 2
  ruleset: Ruleset
  kind: "facility"
  id: non-empty string
  name: non-empty string
  facilityType: non-empty string
  orders: string[]
  description: string
  nameKey?: non-empty string
  label?: string | null
  sort?: integer
  minimumLevel?: integer 0..20
  prerequisite?: string | null
  hirelings?: nonnegative integer | null
  allowMultiple?: boolean
  space?: string | null
}

BastionEntry = BastionSpace | BastionOrder | BastionFacility
```

---

# Structured effects

Structured effects are accepted in `Item.effects`, `ClassTalent.effects`, `ClassFeature.effects`, `Trait.effects`, and `Feat.mechanics.grants.effects`.

Important validation detail: the current server schema strictly checks the effect `type` but deliberately passes through the type-specific fields. The shapes below are the complete runtime contract. Author against these shapes; merely passing server validation does not make an invented effect field useful.

Two legacy source facts are also accepted:

```text
{ kind: "source_modifier", category: string | null, value: string }
{ kind: "source_special", value: string }
{ kind: "source_proficiency", value: string }
```

## Common effect fields

Every runtime structured effect may contain:

```text
EffectBase = {
  id: string
  source: {
    id: string
    kind: "class" | "subclass" | "species" | "background" | "feat" |
          "invocation" | "item" | "other"
    name: string
    level?: number | null
    parentName?: string | null
    text?: string | null
  }
  summary?: string
  gate?: EffectGate
  resolution?: "automatic" | "manual"
  requiredLevel?: number
}

EffectGate = {
  duration?: "instant" | "passive" | "while_equipped" | "while_unarmored" |
             "while_not_heavy_armor" | "while_raging" | "while_wild_shaped" |
             "while_concentrating" | "until_end_of_turn" |
             "until_start_of_next_turn" | "until_end_of_next_turn" |
             "for_1_minute" | "special"
  armorState?: "any" | "no_armor" | "not_heavy" | "not_unarmored"
  shieldAllowed?: boolean
  weaponTag?: "melee" | "ranged" | "finesse" | "light" | "simple" | "martial"
  attackAbility?: Ability
  weaponFilters?: WeaponFilter[]
  notes?: string
}

WeaponFilter = "simple_weapon" | "martial_weapon" | "melee_weapon" |
  "ranged_weapon" | "finesse_weapon" | "light_weapon" | "heavy_weapon" |
  "crossbow_weapon" | "longbow_or_shortbow" | "light_crossbow" |
  "no_two_handed" | "thrown_weapon" | "magic_weapon" | "no_offhand"

ResetKind = "short_rest" | "long_rest" | "short_or_long_rest" | "initiative" |
            "turn_start" | "rage_start" | "never" | "special"
```

Canonical source data may omit generated `id` and `source` when the ingestion path supplies them, but fully materialized runtime effects contain both.

## Scaling values, dice, and choices

```text
ScalingValue =
  { kind: "fixed", value: number } |
  { kind: "ability_mod", ability: Ability, min?: number, max?: number } |
  { kind: "proficiency_bonus", multiplier?: number, min?: number, max?: number } |
  { kind: "class_level", className?: string | null, multiplier?: number, min?: number, max?: number } |
  { kind: "character_level", multiplier?: number, min?: number, max?: number } |
  { kind: "half_class_level", className?: string | null, round: "up" | "down", min?: number, max?: number } |
  { kind: "half_character_level", round: "up" | "down", min?: number, max?: number } |
  { kind: "named_progression", key: string }

ScalingDice =
  { kind: "fixed", dice: string } |
  { kind: "per_scalar", scalar: ScalingValue, die: string } |
  { kind: "named_progression", key: string }

ChoiceSpec = {
  count: ScalingValue
  options?: string[]
  optionCategory?: "skill" | "tool" | "language" | "weapon" |
                   "weapon_mastery" | "spell" | "feat" |
                   "subclass_option" | "damage_type"
  filters?: ("has_proficiency" | WeaponFilter)[]
  canReplaceOnReset?: ResetKind
  ifProficient?: string
}
```

## Effect variants

```text
AbilityScoreEffect = EffectBase & {
  type: "ability_score"
  mode: "fixed" | "choice" | "set_minimum"
  ability?: Ability
  chooseFrom?: Ability[]
  choiceCount: number
  amount: number
  maximum?: number
}

ResourceGrantEffect = EffectBase & {
  type: "resource_grant"
  resourceKey: string
  label: string
  max: ScalingValue
  reset?: ResetKind
  restoreAmount?: "all" | "one" | ScalingValue
  linkedSpellName?: string
}

SpellGrantEffect = EffectBase & {
  type: "spell_grant"
  spellName: string
  spellId?: string
  spellList?: string | null
  mode: "known" | "always_prepared" | "at_will" | "free_cast" | "expanded_list"
  uses?: ScalingValue
  reset?: ResetKind
  castsWithoutSlot?: boolean
  noMaterialComponents?: boolean
  noConcentration?: boolean
  resourceKey?: string
  riderSummary?: string
}

SpellChoiceEffect = EffectBase & {
  type: "spell_choice"
  mode: "learn" | "prepare" | "spellbook" | "select"
  choiceId?: string
  count: ScalingValue
  level: number | null
  spellLists: string[]
  schools?: string[]
  note?: string
  freeCast?: boolean
  ifKnown?: string
  filters?: { damage?: true, attack?: true, ritual?: true, known?: true }
}

ProficiencyGrantEffect = EffectBase & {
  type: "proficiency_grant"
  category: "skill" | "tool" | "language" | "armor" | "weapon" |
            "saving_throw" | "initiative"
  grants?: string[]
  weaponFilter?: {
    melee?: true
    martial?: true
    excludeProperties?: ("heavy" | "two_handed")[]
  }
  choice?: ChoiceSpec
  expertise?: boolean
}

WeaponMasteryEffect = EffectBase & {
  type: "weapon_mastery"
  grants?: string[]
  choice?: ChoiceSpec
}

ArmorClassEffect = EffectBase & {
  type: "armor_class"
  mode: "base_formula" | "minimum_floor" | "bonus"
  base?: number
  abilities?: Ability[]
  bonus?: ScalingValue
}

SpeedEffect = EffectBase & {
  type: "speed"
  mode: "bonus" | "set" | "grant_mode"
  amount?: ScalingValue
  movementMode?: "walk" | "fly" | "swim" | "climb" | "burrow"
}

DefenseEffect = EffectBase & {
  type: "defense"
  mode: "damage_resistance" | "damage_immunity" | "condition_immunity" |
        "condition_advantage" | "save_advantage" | "save_disadvantage" |
        "attack_advantage" | "attack_disadvantage" | "escape_check_advantage"
  targets: string[]
  causeFilter?: string[]
}

ModifierEffect = EffectBase & {
  type: "modifier"
  target: "ability_check" | "initiative" | "skill_check" | "saving_throw" |
          "attack_roll" | "damage_roll" | "spell_attack" | "spell_save_dc" |
          "passive_score" | "any_d20_test" | "carrying_capacity"
  mode: "bonus" | "set_minimum" | "advantage" | "disadvantage" | "reroll"
  amount?: ScalingValue
  appliesTo?: string[]
}

HitPointEffect = EffectBase & {
  type: "hit_points"
  mode: "max_bonus" | "temp_hp" | "drop_to_floor" | "heal_pool"
  amount: ScalingValue | ScalingDice
  reset?: ResetKind
}

AttackEffect = EffectBase & {
  type: "attack"
  mode: "extra_attack" | "bonus_damage" | "damage_die_override" |
        "add_ability_to_damage" | "weapon_ability_override" |
        "replace_attack_with_cantrip" | "triggered_attack"
  amount?: ScalingValue | ScalingDice
  alternateAmount?: ScalingDice
  alternateWhen?: "no_weapon_or_shield"
  ability?: Ability
  damageType?: "same_as_attack" | string
  frequency?: "once_per_turn" | "first_hit_each_turn" | "once_per_rage" | "special"
}

CheckOverrideEffect = EffectBase & {
  type: "check_override"
  skills: string[]
  useAbility: Ability
}

ActionEffect = EffectBase & {
  type: "action"
  activation: "action" | "bonus_action" | "reaction" | "no_action"
  reset?: ResetKind
  uses?: ScalingValue
  actionKey?: string
  description: string
}

SensesEffect = EffectBase & {
  type: "senses"
  mode: "grant" | "bonus"
  senses: {
    kind: "darkvision" | "blindsight" | "tremorsense" | "truesight" | "devils_sight"
    range: number
  }[]
}

BreathingEffect = EffectBase & {
  type: "breathing"
  medium: "water"
}

ChoiceBundleEffect = EffectBase & {
  type: "choice_bundle"
  choice: ChoiceSpec
  options: {
    optionId: string
    label: string
    effects: StructuredEffect[]
  }[]
}

NarrativeEffect = EffectBase & {
  type: "narrative"
  category: "reference" | "manual_resolution"
  description: string
}

FeatChoiceEffect = EffectBase & {
  type: "feat_choice"
  mode: "learn"
  choiceId?: string
  count: ScalingValue
  category?: "origin" | "general" | "fighting_style" | "epic_boon"
}

RestRuleEffect = EffectBase & {
  type: "rest_rule"
  mode: "long_rest_duration" | "no_sleep_required"
  hours?: number
}
```

`StructuredEffect` is the union of all variants above.

---

# Authoring checklist

Before importing a Grand document:

1. Every entry has a stable `id`, `ruleset`, and every category-specific required field.
2. Every enum or literal uses one of the exact values shown here, including capitalization.
3. Optional empty objects/arrays and false literal flags are omitted.
4. Cross-entry references use real canonical IDs (`s_`, `i_`, `f_`, `ct_`, `sl_`, and so on).
5. Mechanics exist in typed fields; prose alone is never expected to drive automation.
6. Mutually exclusive fields and relationship rules are satisfied.
7. The complete document is tested against the same Zod category schemas used by the importer.
