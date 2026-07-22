# Beholden AI Content Authoring Guide

This file is the complete handoff contract for an AI helping design content for Beholden. Give the AI this file together with the creative material from the conversation. The Beholden source code is not required.

## Instructions for the AI

When asked to create Beholden content:

1. Determine whether the requested output is an **adventure import**, **character import**, or category-specific **Beholden Compendium batch**.
2. Preserve the user's creative decisions. Fill only genuinely missing implementation details.
3. Follow the exact field names, types, nesting, and limitations in this guide.
4. Every compendium entry requires an explicit stable `id`. Derive it once from the entry name using the prefix rules below, then use that exact ID for every reference.
5. Check encounter balance, creature quantities, HP, AC, treasure quantities, character totals, and internal consistency before answering.
6. For an import file, return exactly one valid JSON document in one `json` code block. Do not put commentary, Markdown, placeholders, ellipses, or JavaScript comments inside the JSON.
7. Use JSON `null`, booleans, and numbers—not the strings `"null"`, `"true"`, or `"10"`.
8. Use UTF-8 JSON. All object keys and string values must use double quotes.
9. Omit optional fields that add no value. Never add speculative fields in the hope that Beholden will understand them.
10. If a required compendium ID is unknown, say what is missing instead of fabricating it. If the user accepts a tracker-only combatant, use an empty `baseId` and explain that it will not have a linked stat block.
11. Beholden never parses rules text for mechanics at runtime. Description prose is player-facing display only. Any benefit the app should apply — ability increases, granted spells, proficiencies, AC or modifier bonuses, resource pools, choices — must be expressed in the entry's typed fields. A benefit that exists only in prose is, by definition, resolved manually at the table.

## Choose the right output

| Request | Output | Can be uploaded directly? |
|---|---|---|
| Adventure, encounter set, adventure notes, or adventure treasure | Adventure import JSON with embedded compendium batches | Yes, through **Import Adventure** |
| Player-owned character | Character import JSON | Yes, through **My Characters → Import** |
| Monsters, items, spells, class talents, classes, species, backgrounds, feats, decks, or bastions | Category-specific Beholden Compendium JSON | Yes, through **Compendium → Import Beholden JSON** |
| Custom treasure used only by one adventure | Put it in the adventure's `treasure` array | Yes, as part of the adventure |

Beholden JSON is the canonical compendium language and authored source of truth. Do not produce or request an intermediate XML representation. Translate source material directly into the canonical schema and validate that JSON before import.

Adventure version 2 may embed those exact native batches in its `compendium` array. Embedded entries are imported first and replace matching compendium IDs, so an adventure can carry every monster, item, spell, or other rules entry it needs.

---

# Grand Beholden Compendium Schema

This section is the exhaustive, field-by-field authoring contract for every Grand
Compendium category — every nested object, union, closed enum, literal value, and
structured-effect variant. It is derived directly from the Zod schemas in
`server/src/services/compendium/grandCompendiumSchemas*.ts` and the structured-effect
runtime contract in `web-player/src/domain/character/featureEffects.ts`. It answers:
which fields exist, which are required, what shape they have, and what exact closed
values are accepted?

Catalogs may contain one or several category arrays. Keeping source catalogs separate is encouraged; the schema does not require combining them.

## Canonical envelope

```json
{
  "format": "beholden.compendium",
  "schema": "grand",
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "monsters": [],
  "items": [],
  "spells": []
}
```

Valid categories are:

```text
monsters, items, spells, classTalents, classes, species, backgrounds, feats, decks, bastions
```

Rules:

- `format` must be exactly `"beholden.compendium"`.
- `schema` must be exactly `"grand"`.
- Each present category property must be one of the valid categories and contain an array of canonical entries.
- Omit categories that the file does not own; do not add empty arrays merely for completeness.
- Decks and bastions contain `"schemaVersion": 2`.
  All other categories omit per-entry `schemaVersion`.
- Every entry contains `"ruleset": "5e"` or `"ruleset": "5.5e"`.
- Imports always overwrite an existing row with the same `id`.
- Every entry must contain a non-empty stable `id`. Grand Schema imports never invent or repair missing IDs.
- Entries use one explicit canonical shape. Unknown or legacy-shaped fields are rejected rather than guessed.
- A file may own multiple categories, but each fact belongs in its matching top-level category array.

Common derived ID prefixes are:

```text
Monster:     m_
Item:        i_
Spell:       s_
Class:       c_
Species:     r_
Background:  bg_
Feat:        f_
```

Use lowercase underscore keys for newly authored IDs, such as `m_orrery_guardian`. Preserve IDs exactly when editing an exported entry because adventures and characters may already reference them.

Multi-category imports are atomic: every populated top-level category array succeeds together or none are applied. Older `batches` documents remain readable for backup compatibility, but new files and exports must use the flat Grand envelope above.

## Notation

- `field: type` means the field is required.
- `field?: type` means the field is optional and should normally be omitted when empty, false, null, or inapplicable.
- `A | B` means either shape/value is accepted.
- `literal true` means `true` is accepted and `false` is not; omit the field for false.
- Unless a shape explicitly says otherwise, objects are strict and unknown fields fail validation.
- `nonnegative integer` means an integer at least 0; `positive integer` means an integer at least 1.
- Every entry requires `ruleset: "5e" | "5.5e"`.

## Shared closed values

```text
Ruleset       = "5e" | "5.5e"
Ability       = "str" | "dex" | "con" | "int" | "wis" | "cha"
Size          = "T" | "S" | "M" | "L" | "H" | "G"
Recovery      = "short_rest" | "long_rest"
Resolution    = "automatic" | "manual" | "mixed"
```

Size meanings are Tiny, Small, Medium, Large, Huge, and Gargantuan.

## Item

### Complete shape

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

### Armor, weapon, modifiers, and rolls

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

### Charges and depletion

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

### Item spell access

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

### Item spell templates

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

### Bundles and containers

```text
ItemBundle = {
  container: itemId matching /^i_/
  items: { [itemId matching /^i_/]: positive integer }
}
```

`items` must not be empty and must not repeat the `container` ID.

## Monster

### Complete shape

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

### Classification and statistics

```text
MonsterClassification = {
  size?: Size
  type?: non-empty string
  description?: non-empty string
  alignment?: non-empty string
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

### Traits, actions, reactions, spellcasting, and legendary actions

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

## Spell

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

## Class talent

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

## Class

### Complete top-level shape

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

### Proficiencies, tools, multiclassing, and spellcasting

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
  requirements: {
    ability: AbilityRequirement
    minimum?: integer 1..30 // 13 is the standard threshold
  }
  skills?: { choose: positive integer, from?: string[] }
  armor?: non-empty string[]
  weapons?: non-empty string[]
  tools?: ToolProficiencies
  spellcasting?:
    { progression: "full" } |
    { progression: "half", rounding?: "down" | "up" } |
    { progression: "third" } |
    { progression: "pact" }
  exceptions?: non-empty string[]
}

ClassSpellcasting = {
  ability?: Ability
  list?: spell-list ID matching /^sl_[a-z0-9_]+$/
  slotRecovery?: "short_rest" | "long_rest"
  preparedSpellChanges?: "short_rest" | "long_rest"
}
```

An existing `tools` object must not be empty. Every `multiclass` object must include typed ability requirements. `rounding` is valid only for half-caster contributions; omitted half-caster rounding means down.

### Levels, resources, and features

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

### Feature choices

```text
SelectionFeatureChoice = {
  id: string matching /^fc_[a-z0-9_]+$/
  kind: "selection"
  label: non-empty string
  count?: positive integer // defaults to 1
  options: non-empty string[] // at least 2
}

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

### Subclasses and class-level option groups

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

## Species

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

### Shared trait shape

Species and backgrounds share this trait contract:

```text
Trait = {
  id: non-empty string
  name: non-empty string
  description: string
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

## Background

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

### Equipment

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

## Feat

### Complete shape and prerequisites

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

### Feat mechanics

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

### Feat choices

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

## Deck card

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

## Bastion

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

## Structured effects

Structured effects are accepted in `Item.effects`, `ClassTalent.effects`, `ClassFeature.effects`, `Trait.effects`, and `Feat.mechanics.grants.effects`.

Important validation detail: the current server schema strictly checks the effect `type` but deliberately passes through the type-specific fields. The shapes below are the complete runtime contract. Author against these shapes; merely passing server validation does not make an invented effect field useful.

Two legacy source facts are also accepted:

```text
{ kind: "source_modifier", category: string | null, value: string }
{ kind: "source_special", value: string }
{ kind: "source_proficiency", value: string }
```

### Common effect fields

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

### Scaling values, dice, and choices

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

### Effect variants

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

## Schema authoring checklist

Before importing a Grand document:

1. Every entry has a stable `id`, `ruleset`, and every category-specific required field.
2. Every enum or literal uses one of the exact values shown here, including capitalization.
3. Optional empty objects/arrays and false literal flags are omitted.
4. Cross-entry references use real canonical IDs (`s_`, `i_`, `f_`, `ct_`, `sl_`, and so on).
5. Mechanics exist in typed fields; prose alone is never expected to drive automation.
6. Mutually exclusive fields and relationship rules are satisfied.
7. The complete document is tested against the same Zod category schemas used by the importer.

---

# Adventure import

## Canonical shape

```json
{
  "format": "beholden.adventure",
  "version": 2,
  "compendium": [],
  "adventure": {
    "name": "Adventure Name",
    "status": "active",
    "notes": [],
    "encounters": [],
    "treasure": []
  }
}
```

New files use adventure `version` 2. Version 1 remains accepted for old files but cannot carry native compendium batches. `adventure.name` is required. Arrays may be empty, but they must contain objects of the shapes below when present.

`compendium` is an array of complete native Beholden Compendium batch objects. Importing the adventure imports these batches first with normal overwrite semantics, then creates the adventure. Use it for any content the adventure must bring with it.

## Adventure fields

| Field | Type | Required | Guidance |
|---|---|---:|---|
| `name` | string | yes | Human-readable adventure title |
| `status` | string | no | Use `"active"` unless the user asks for another status |
| `notes` | note[] | no | Defaults to `[]` |
| `encounters` | encounter[] | no | Defaults to `[]` |
| `treasure` | treasure[] | no | Defaults to `[]` |

If an adventure with the same name already exists, Beholden imports this one as `Name (Imported)`.

## Notes

```json
{
  "title": "Arrival at the Observatory",
  "text": "Read-aloud text, DM information, clues, checks, consequences, and transitions.",
  "sort": 1
}
```

| Field | Type | Required | Guidance |
|---|---|---:|---|
| `title` | string | yes | Short, useful title |
| `text` | string | yes | Plain text; line breaks may be encoded as `\n` |
| `sort` | number | no | Use consecutive values starting at `1` |

Notes are the place for all adventure information that has no dedicated import field. A strong encounter-design note usually includes:

- scene purpose and sensory introduction;
- read-aloud text, if desired;
- creature tactics and morale;
- terrain, hazards, cover, lighting, and starting positions;
- checks with DCs and the result of success or failure;
- clues and information the party can discover;
- alternate approaches and likely consequences;
- links or transitions to the next scene;
- scaling advice when party size or level is uncertain.

Keep secrets and DM-only information in separate notes when that makes the adventure easier to run.

## Encounters

```json
{
  "name": "Guardians in the Orrery",
  "status": "Open",
  "sort": 1,
  "combatants": []
}
```

| Field | Type | Required | Guidance |
|---|---|---:|---|
| `name` | string | yes | Distinct encounter name |
| `status` | string | no | Use `"Open"` |
| `sort` | number | no | Use consecutive values starting at `1` |
| `combatants` | combatant[] | no | Defaults to `[]` |

An encounter is a roster and combat tracker. Narrative setup, maps, tactics, hazards, waves, and rewards belong in notes.

## Combatants

```json
{
  "baseType": "monster",
  "baseId": "m_animated armor",
  "name": "Animated Armor",
  "label": "West Gallery Armor",
  "initiative": null,
  "friendly": false,
  "color": "#888888",
  "hpMax": 33,
  "hpCurrent": 33,
  "hpDetails": "6d8 + 6",
  "ac": 18,
  "acDetails": "natural armor",
  "attackOverrides": null,
  "conditions": [],
  "overrides": {
    "tempHp": 0,
    "acBonus": 0,
    "hpMaxBonus": 0,
    "inspiration": false
  },
  "sort": 1
}
```

| Field | Type | Required | Default / meaning |
|---|---|---:|---|
| `baseType` | `"player"` \| `"monster"` \| `"inpc"` | no | `"monster"` |
| `baseId` | string | no | `""`; ID of the linked record |
| `name` | string | yes | Base display name |
| `label` | string | yes | Unique battlefield label; may equal `name` for a single creature |
| `initiative` | number \| null | no | `null`; roll at play time |
| `friendly` | boolean | no | `false` |
| `color` | string | no | `"#888888"`; use a CSS hex color |
| `hpMax` | number \| null | no | `null` |
| `hpCurrent` | number \| null | no | `null`; normally equal to `hpMax` |
| `hpDetails` | string \| null | no | `null`; e.g. hit-dice expression |
| `ac` | number \| null | no | `null` |
| `acDetails` | string \| null | no | `null`; e.g. `"natural armor"` |
| `attackOverrides` | object \| null | no | `null` |
| `conditions` | condition[] | no | `[]` |
| `overrides` | overrides object | no | Zeroed values shown above |
| `sort` | number | no | Import order |

### Linking monsters correctly

For useful monster stat blocks and actions, `baseType` must be `"monster"` and `baseId` must exactly match a monster in the user's compendium.

Canonical monster IDs use the `m_` prefix followed by a stable lowercase underscore key, such as `m_animated_armor` or `m_adult_red_dragon`. References must use the exact authored ID; never derive a reference from a display name at runtime.

Do not use `"player"` or `"inpc"` in portable adventure files unless the user supplies IDs from the destination campaign. Those IDs are campaign-specific.

A monster with `baseId: ""` can still track the supplied name, HP, and AC, but it will not have a linked compendium stat block, actions, CR, XP, or full difficulty data. For a new monster, embed a `"monsters"` Beholden Compendium batch and set the combatant's `baseId` to that entry's exact `id`.

### Repeated creatures

Create one combatant object per creature. Reuse the same `baseId` and `name`, but give each a distinct `label`, such as `"Goblin 1"`, `"Goblin 2"`, or a role-based label. Give each object its own `sort`.

### Attack overrides

`attackOverrides` changes attacks on an existing linked monster. Keys must exactly match action names in that monster's stat block.

```json
{
  "Longsword": {
    "toHit": 6,
    "damage": "1d8 + 4",
    "damageType": "slashing"
  }
}
```

Each attack override may contain:

| Field | Type |
|---|---|
| `toHit` | number |
| `damage` | string |
| `damageType` | string |

This cannot create a brand-new action. Use `null` unless the user explicitly wants a known linked monster attack adjusted.

### Conditions

```json
{
  "key": "poisoned"
}
```

Valid built-in condition keys are:

```text
blinded, charmed, deafened, frightened, grappled, incapacitated,
invisible, paralyzed, petrified, poisoned, prone, restrained,
stunned, unconscious, concentration, disadvantage, hexed, marked
```

`hexed` may also have `hexAbility` set to `"str"`, `"dex"`, `"con"`, `"int"`, `"wis"`, or `"cha"`. `hexed` and `marked` may have a `casterId`, but portable files normally cannot know that generated combatant ID. Prefer `conditions: []` unless the encounter begins with a deliberate condition whose references are not required.

### Overrides

```json
{
  "tempHp": 0,
  "acBonus": 0,
  "hpMaxBonus": 0,
  "inspiration": false,
  "abilityScores": {
    "str": 18
  }
}
```

`tempHp`, `acBonus`, and `hpMaxBonus` are numbers. `inspiration` is a boolean. `abilityScores` is optional; each supplied score must be an integer from 1 through 30.

## Adventure treasure

### Custom treasure

```json
{
  "source": "custom",
  "itemId": null,
  "name": "Moon-Silver Observatory Key",
  "rarity": "uncommon",
  "type": "Wondrous Item",
  "type_key": "wondrous_item",
  "attunement": false,
  "magic": true,
  "text": "This key opens the sealed doors of the old observatory. Under moonlight, its teeth rearrange to fit the nearest lock made by its original artificer.",
  "qty": 1,
  "sort": 1
}
```

### Existing compendium treasure

```json
{
  "source": "compendium",
  "itemId": "i_potion_of_healing",
  "name": "Potion of Healing",
  "rarity": "common",
  "type": "Potion",
  "type_key": "potion",
  "attunement": false,
  "magic": true,
  "text": "A creature that drinks this potion regains hit points.",
  "qty": 2,
  "sort": 2
}
```

| Field | Type | Required | Default / guidance |
|---|---|---:|---|
| `source` | `"custom"` \| `"compendium"` | no | `"custom"` |
| `itemId` | string \| null | no | `null`; exact compendium ID when source is `"compendium"` |
| `name` | string | no | `"New Item"`; always provide a meaningful name |
| `rarity` | string \| null | no | Lowercase standard rarity when applicable |
| `type` | string \| null | no | Human-readable type |
| `type_key` | string \| null | no | Lowercase type with spaces replaced by underscores |
| `attunement` | boolean | no | `false` |
| `magic` | boolean | no | `false` |
| `text` | string | no | `""` |
| `qty` | positive integer | no | `1` |
| `sort` | number | no | Import order |

Standard rarity values are `"common"`, `"uncommon"`, `"rare"`, `"very rare"`, `"legendary"`, and `"artifact"`.

Canonical item IDs use `i_` followed by a stable lowercase underscore key, for example `i_potion_of_healing`. Use `"compendium"` only if the exact destination item ID is known. Otherwise use `"custom"` and `null`.

## Complete adventure example

```json
{
  "format": "beholden.adventure",
  "version": 2,
  "compendium": [
    {
      "format": "beholden.compendium",
      "schema": "grand",
      "category": "monsters",
      "exportedAt": "2026-06-28T00:00:00.000Z",
      "entries": [
        {
          "id": "m_orrery_guardian",
          "ruleset": "5.5e",
          "name": "Orrery Guardian",
          "source": "The Silent Orrery",
          "classification": {
            "size": "M",
            "type": "construct",
            "description": "Medium construct",
            "alignment": "unaligned",
            "environment": ["urban"]
          },
          "description": "A tireless brass guardian built to protect the orrery.",
          "initiativeBonus": 0,
          "passivePerception": 6,
          "challenge": {
            "rating": "1",
            "xp": 200
          },
          "armorClass": {
            "value": 18,
            "source": "brass plating"
          },
          "hitPoints": {
            "formula": "6d8 + 6"
          },
          "movement": {
            "walk": 25
          },
          "abilities": {
            "str": 14,
            "dex": 11,
            "con": 13,
            "int": 1,
            "wis": 3,
            "cha": 1
          },
          "defenses": {
            "damageImmunities": ["poison", "psychic"],
            "conditionImmunities": ["blinded", "charmed", "deafened", "exhaustion", "frightened", "paralyzed", "petrified", "poisoned"]
          },
          "senses": ["blindsight 60 ft. (blind beyond this radius)", "passive Perception 6"],
          "languages": ["understands the languages of its creator but can't speak"],
          "traits": [
            {
              "id": "antimagic_susceptibility",
              "name": "Antimagic Susceptibility",
              "description": "The guardian is incapacitated while in the area of an antimagic field."
            }
          ],
          "actions": [
            {
              "id": "brass_fist",
              "name": "Brass Fist",
              "description": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) bludgeoning damage.",
              "attack": {
                "toHit": 4,
                "reach": "5ft",
                "melee": true
              },
              "damage": { "roll": "1d6+2", "type": "bludgeoning" }
            }
          ]
        }
      ]
    }
  ],
  "adventure": {
    "name": "The Silent Orrery",
    "status": "active",
    "notes": [
      {
        "title": "Adventure Overview",
        "text": "The observatory has awakened after a century of silence. The party must recover the moon-silver key before the mechanism completes its final alignment.\n\nRecommended flow: Arrival, investigation, guardian encounter, then the sealed lens chamber.",
        "sort": 1
      },
      {
        "title": "Guardians in the Orrery",
        "text": "The two suits stand motionless among the brass rings until a creature touches the central controls.\n\nTactics: The guardians block the narrow approaches and focus on anyone carrying the key. A guardian reduced below half its hit points retreats onto the rotating platform to force pursuit.\n\nTerrain: The waist-high control consoles grant half cover. On initiative count 20, the outer ring turns; each creature on it must succeed on a DC 12 Dexterity saving throw or move 10 feet clockwise.",
        "sort": 2
      }
    ],
    "encounters": [
      {
        "name": "Guardians in the Orrery",
        "status": "Open",
        "sort": 1,
        "combatants": [
          {
            "baseType": "monster",
            "baseId": "m_orrery_guardian",
            "name": "Orrery Guardian",
            "label": "North Gallery Armor",
            "initiative": null,
            "friendly": false,
            "color": "#7c8ca0",
            "hpMax": 33,
            "hpCurrent": 33,
            "hpDetails": "6d8 + 6",
            "ac": 18,
            "acDetails": "natural armor",
            "attackOverrides": null,
            "conditions": [],
            "overrides": {
              "tempHp": 0,
              "acBonus": 0,
              "hpMaxBonus": 0,
              "inspiration": false
            },
            "sort": 1
          },
          {
            "baseType": "monster",
            "baseId": "m_orrery_guardian",
            "name": "Orrery Guardian",
            "label": "South Gallery Armor",
            "initiative": null,
            "friendly": false,
            "color": "#7c8ca0",
            "hpMax": 33,
            "hpCurrent": 33,
            "hpDetails": "6d8 + 6",
            "ac": 18,
            "acDetails": "natural armor",
            "attackOverrides": null,
            "conditions": [],
            "overrides": {
              "tempHp": 0,
              "acBonus": 0,
              "hpMaxBonus": 0,
              "inspiration": false
            },
            "sort": 2
          }
        ]
      }
    ],
    "treasure": [
      {
        "source": "custom",
        "itemId": null,
        "name": "Moon-Silver Observatory Key",
        "rarity": "uncommon",
        "type": "Wondrous Item",
        "type_key": "wondrous_item",
        "attunement": false,
        "magic": true,
        "text": "This key opens the sealed doors of the old observatory.",
        "qty": 1,
        "sort": 1
      }
    ]
  }
}
```

## Adventure final check

Before returning the file, verify:

- `format` is `"beholden.adventure"` and `version` is exactly `2`;
- every embedded compendium object is a valid Grand Schema category batch;
- every note has both `title` and `text`;
- every encounter has `name`;
- every combatant has both `name` and `label`;
- each creature has its own combatant object and unique label;
- `hpCurrent` is not greater than `hpMax`;
- exact compendium IDs are used only when justified;
- custom treasure uses `"source": "custom"` and `"itemId": null`;
- all `qty` values are positive integers;
- sort values are consecutive and reflect play order;
- every new linked compendium entry is embedded and its `id` exactly matches all references.

---

# Standalone item batch

Items use the same native batch pipeline as every other compendium category. The file can be imported directly through **Compendium → Import Beholden JSON**, embedded in an adventure's `compendium` array, or exported again after editing in Beholden.

## Full item shape

```json
{
  "format": "beholden.compendium",
  "schema": "grand",
  "category": "items",
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "entries": [
    {
      "id": "i_gloamglass_dagger",
      "ruleset": "5.5e",
      "name": "Gloamglass Dagger",
      "source": "The Silent Orrery",
      "type": "Melee Weapon",
      "rarity": "uncommon",
      "magical": true,
      "attunement": true,
      "equippable": true,
      "weight": 1,
      "value": 500,
      "proficiency": "Simple Weapons",
      "weapon": {
        "damage": "1d4",
        "damageType": "P",
        "range": "20/60",
        "properties": ["F", "L", "T"]
      },
      "modifiers": [
        { "target": "weapon_attacks", "amount": 1 },
        { "target": "weapon_damage", "amount": 1 }
      ],
      "description": [
        "You gain a +1 bonus to attack and damage rolls made with this magic weapon.",
        "While holding the dagger in dim light or darkness, you can take the Hide action as a bonus action."
      ]
    }
  ]
}
```

Grand Schema item entries are sparse: omit defaults, nulls, empty arrays, and inapplicable armor/weapon blocks. Older verbose exports are rejected.

| Field | Type | Guidance |
|---|---|---|
| `id` | stable `i_` ID | Required; imports never invent or repair IDs |
| `name` | non-empty string | Required display name |
| `type` | non-empty string | Item category; the filter key is derived automatically |
| `rarity` | non-empty string | Item rarity |
| `magical` | literal `true` | Omit for nonmagical items |
| `attunement` | `true` or string | Omit when not required; use a string for requirements |
| `equippable` | literal `true` | Omit when false |
| `weight`, `value` | nonnegative number | Omit when unknown |
| `proficiency` | string | Omit when none |
| `armor` | object | Optional `ac`, `stealthDisadvantage: true`, and `strength` |
| `weapon` | object | Damage formulas, damage type, range, and properties |
| `modifiers` | object[] | Omit when empty; each object is a typed fact `{ "target", "amount" }`. Targets: `ac`, `melee_attacks`, `melee_damage`, `ranged_attacks`, `ranged_damage`, `weapon_attacks`, `weapon_damage`, `saving_throws`, `ability_checks`, `spell_attack`, `spell_save_dc`, `initiative`, `proficiency_bonus`. Ability-score changes go in `effects` (`ability_score`), never here |
| `rolls` | object[] | Omit when empty; each has `formula` and optional `description` |
| `description` | string or string[] | Prefer a string; use an array only for separate blocks |

Known item types:

```text
Light Armor, Medium Armor, Heavy Armor, Shield,
Melee Weapon, Ranged Weapon, Ammo,
Potion, Scroll, Wand, Rod, Staff, Ring,
Wondrous Item, Adventuring Gear, Currency, Other
```

`Ammo` is required exactly when the item sets a top-level `ammo` family (`arrow`, `bolt`, `energy-cell`, `firearm-bullet`, `needle`, `sling-bullet`).

Recognized damage type codes:

| Code | Type | Code | Type |
|---|---|---|---|
| `B` | Bludgeoning | `P` | Piercing |
| `S` | Slashing | `A` | Acid |
| `C` | Cold | `F` | Fire |
| `FC` | Force | `L` | Lightning |
| `N` | Necrotic | `PS` | Poison |
| `PY` | Psychic | `R` | Radiant |
| `T` | Thunder |  |  |

Recognized property codes:

| Code | Property | Code | Property |
|---|---|---|---|
| `A` | Ammunition | `AF` | Ammunition (Firearm) |
| `BF` | Burst Fire | `F` | Finesse |
| `H` | Heavy | `L` | Light |
| `LD` | Loading | `M` | Martial |
| `R` | Reach | `RC` | Reload |
| `S` | Special | `T` | Thrown |
| `V` | Versatile | `2H` | Two-Handed |

The app's New Item form is a convenience editor; exported native files use the sparse Grand Schema shape above.

Beholden creates a new item ID as `i_` plus the lowercased name with whitespace changed to underscores. Avoid creating two custom items whose names normalize to the same ID; the newer one replaces the older record.

## Item final check

- The rules text states activation, range, target, duration, save DC, recharge, charges, and reset timing whenever they matter.
- Weapon and armor stats agree with the narrative rules.
- `attunement` is present only when required, and `magical` is present only when true.
- `rarity` is proportionate to the item's power.
- Damage and property codes use the recognized codes when possible.
- `description` contains final player-facing rules, not design notes or unresolved alternatives.

---

# Other native category entries

Wrap each entry below in the canonical batch envelope and set the matching `category`. Use exactly the documented fields: the Grand Schema rejects unknown additions and legacy aliases.

## Spells

```json
{
  "id": "s_starfall_lance",
  "ruleset": "5.5e",
  "name": "Starfall Lance",
  "level": 3,
  "school": "Evocation",
  "casting": {
    "time": "Action",
    "range": "120 feet",
    "components": {
      "verbal": true,
      "somatic": true,
      "material": "a sliver of meteoric iron"
    },
    "duration": {
      "description": "Instantaneous"
    }
  },
  "access": ["sl_sorcerer", "sl_wizard"],
  "rolls": [
    {
      "description": "Radiant Damage",
      "level": 3,
      "formula": "6d6"
    },
    {
      "description": "Radiant Damage",
      "level": 4,
      "formula": "7d6"
    }
  ],
  "description": [
    "A streak of white fire strikes one creature you can see within range. The target makes a Dexterity saving throw, taking 6d6 radiant damage on a failed save or half as much on a successful one.",
    "At Higher Levels. The damage increases by 1d6 for each slot level above 3."
  ]
}
```

`name` is required. `level` should be an integer from 0 through 9. Use a full
school name: `Abjuration`, `Conjuration`, `Divination`, `Enchantment`,
`Evocation`, `Illusion`, `Necromancy`, or `Transmutation`. Canonical casting
times use a number and title-cased unit, such as `1 Action`, `1 Bonus Action`,
`1 Reaction`, or `10 Minutes`; append a reaction trigger after a comma.
`access` contains stable `sl_` IDs declared once in the owning Class record's
`spellLists` registry. Casting time, range,
components, duration, concentration, and dice
formulas are explicit and are never inferred from rules prose. Omit false
booleans, absent values, and empty arrays. A material component is `true` when
it has no useful description, or its description string when it does.
Concentration and ritual are written only as `true`. A roll's optional
`level` (0-20) is a character-level tier on a cantrip and a slot level on a
leveled spell — the scaling basis is derived from the spell's own `level`,
never stored per row.

## Classes

```json
{
  "id": "c_wayfinder",
  "ruleset": "5.5e",
  "name": "Wayfinder",
  "source": "Homebrew",
  "description": "Wayfinders explore dangerous frontiers and guide others through them.",
  "hitDie": 10,
  "proficiencies": {
    "savingThrows": ["dex", "wis"],
    "skills": {
      "choose": 2,
      "from": ["Athletics", "Insight", "Nature", "Perception", "Stealth", "Survival"]
    },
    "armor": ["Light Armor", "Medium Armor", "Shields"],
    "weapons": ["Simple Weapons", "Martial Weapons"]
  },
  "spellcasting": {
    "slotRecovery": "long_rest"
  },
  "levels": [
    {
      "level": 1,
      "features": [
        {
          "id": "trailwise",
          "name": "Trailwise",
          "description": "You gain the benefits described by this feature."
        }
      ]
    }
  ]
}
```

`name`, `hitDie`, `proficiencies`, `spellcasting`, and `levels` are required.
Use `descriptions` to preserve every class-level lore block and `description`
for the primary compact description. A class has at most one object for each
level; duplicate level rows are invalid. Omit nulls, empty collections, `false`
booleans, and absent optionals (`source`, `startingWealth`, `spellcasting.ability`,
`tools`, `abilityScoreImprovement`, `cantripsKnown`, `spellSlots`). The importer
automatically assigns `"resolution": "manual"` to each feature; supply an explicit
`resolution` only when the feature is fully automatic or mixed.

## Species

```json
{
  "id": "r_emberkin",
  "ruleset": "5.5e",
  "name": "Emberkin",
  "size": "M",
  "speed": 30,
  "traits": [
    {
      "id": "fire_resistance",
      "name": "Fire Resistance",
      "description": "You have resistance to fire damage.",
      "resolution": "automatic",
      "effects": [{ "type": "defense", "mode": "damage_resistance", "targets": ["Fire"] }]
    }
  ]
}
```

`name`, `speed`, and `traits` are required. Trait objects use `id`, `name`, and `description`; a trait with deterministic mechanics should also set `resolution` (`"automatic"` when `effects` fully describes it, `"mixed"` when some remainder stays in prose, `"manual"` only for genuine table adjudication) and an `effects` array of typed facts consumed directly — not recovered by parsing the trait's own `description` at runtime. The top-level `resistances`/`vision` fields are legacy/display-only duplicates of facts a trait's own `effects` should express (a `defense`/`senses` effect) — omit them whenever the equivalent trait exists; they exist only for species not yet migrated to structured traits. Omit nulls, empty collections, and absent optionals (`source`, `size`, `spellcastingAbility`, `resistances`, `vision`, `choices`).

## Backgrounds

```json
{
  "id": "bg_stargazer",
  "ruleset": "5.5e",
  "name": "Stargazer",
  "description": "You chart the night sky and interpret the movements of distant stars.",
  "proficiencies": {
    "skills": ["Arcana", "Perception"],
    "languages": {
      "choose": 2
    },
    "featChoice": 1,
    "abilityScores": ["Intelligence", "Wisdom", "Charisma"],
    "abilityScoreChoose": 3
  },
  "equipment": {
    "options": [
      {
        "id": "A",
        "entries": [
          { "kind": "item", "itemId": "i_star_chart", "quantity": 1 },
          { "kind": "item", "itemId": "i_spyglass", "quantity": 1 },
          { "kind": "item", "itemId": "i_travelers_clothes", "quantity": 1 },
          { "kind": "currency", "denomination": "GP", "amount": 15 }
        ]
      },
      {
        "id": "B",
        "entries": [
          { "kind": "currency", "denomination": "GP", "amount": 50 }
        ]
      }
    ]
  }
}
```

The surrounding document already declares the Grand Schema, so backgrounds do not repeat
`schemaVersion`. Fixed proficiencies are arrays; use `{ "choose": N, "from":
[...] }` only for real choices. Omit nulls, empty collections, and zero-valued
defaults. Equipment with structured options does not repeat its prose list.
Fixed feats reference their canonical `f_` IDs; Feat mechanics live only on the
referenced Feat record and character creation resolves them from that owner.

## Feats

A feat that is entirely adjudicated at the table needs only prose:

```json
{
  "id": "f_orbit_step",
  "ruleset": "5.5e",
  "name": "Orbit Step",
  "prerequisite": { "level": 4 },
  "description": "Immediately after you take the Dash action, you can teleport up to 10 feet to an unoccupied space you can see.",
  "resolution": "manual",
  "resolutionNotes": ["Resolve the Dash trigger and teleport manually."]
}
```

Any benefit Beholden should apply must live in `mechanics` — the description is
never parsed. A typical mixed feat:

```json
{
  "id": "f_wardbearer",
  "ruleset": "5.5e",
  "name": "Wardbearer",
  "prerequisite": { "level": 4, "feature": "spellcasting" },
  "description": "You gain the following benefits. Ability Score Increase. Increase your Charisma score by 1, to a maximum of 20. Warded Mind. You have Advantage on Constitution saving throws that you make to maintain Concentration. Lore of Wards. You gain proficiency in Arcana, History, or Religion. Ward Touch. A number of times equal to your Proficiency Bonus, you can end one spell of level 3 or lower on a willing creature you touch; you regain all expended uses when you finish a Long Rest.",
  "resolution": "mixed",
  "mechanics": {
    "grants": {
      "abilityIncreases": { "charisma": 1 },
      "effects": [
        {
          "type": "modifier",
          "target": "saving_throw",
          "mode": "advantage",
          "appliesTo": ["Constitution"],
          "gate": { "notes": "Only saving throws made to maintain Concentration" },
          "summary": "Advantage on Constitution saves to maintain Concentration"
        }
      ]
    },
    "choices": [
      { "id": "skill_1", "type": "proficiency", "count": 1, "options": ["Arcana", "History", "Religion"] }
    ],
    "uses": [
      { "count": 1, "countFrom": "proficiency_bonus", "note": "a number of times equal to your Proficiency Bonus" }
    ]
  }
}
```

- `name` is required. Write deterministic rules text: specify trigger, action
  cost, range, target, duration, limits, and reset timing when applicable.
- `grants` holds unconditional facts: `abilityIncreases`, granted `spells`/
  `cantrips`, proficiency lists, and `effects` (typed shapes such as
  `modifier`, `armor_class`, `defense`, `spell_grant`, `action`,
  `resource_grant`; give conditional effects a `gate` so the app stays honest
  about when they apply).
- `choices` holds player decisions (`proficiency`, `expertise`,
  `ability_score`, `spell`, `spell_list`, `weapon_mastery`, `damage_type`).
  Spell choices constrain with typed fields — `level` (exactly), `maxLevel`
  ("at or below"), `ritual: true` — never with wording in a note.
- `uses` describes a limited-use pool; Beholden derives the tracked resource
  from it. Never author a `resource_grant` effect for the same pool — that
  duplicates the fact.
- `resolution` and `resolutionNotes` sit at the top level of the entry, not
  inside `mechanics`.

Use `"resolution": "automatic"` only when every benefit has been reviewed and is
fully handled by Beholden. Use `"manual"` when the feat is entirely adjudicated
at the table, and `"mixed"` when Beholden applies some structured benefits but
the remaining prose still requires manual resolution. Add `resolutionNotes`
only when they provide specific information beyond the resolution value and
description. Omit nulls, false defaults, empty collections, and mechanics
metadata already present at the feat root. Beholden records mechanics and
bonuses; it never resolves dice or makes table decisions.

## Decks

The `"decks"` category contains one entry per card:

```json
{
  "schemaVersion": 2,
  "ruleset": "5.5e",
  "id": "deck:omens:the-comet",
  "deckName": "Deck of Omens",
  "deckKey": "omens",
  "cardName": "The Comet",
  "cardKey": "the-comet",
  "text": "A distant opportunity arrives sooner than expected.",
  "sort": 1
}
```

`deckName` and `cardName` are required. Reuse the same `deckKey` for every card in one deck and give each card a unique `id`.

## Bastions

The `"bastions"` category contains three entry kinds.

Space:

```json
{
  "schemaVersion": 2,
  "ruleset": "5.5e",
  "kind": "space",
  "id": "bastion-space:roomy",
  "name": "Roomy",
  "nameKey": "roomy",
  "squares": 16,
  "label": "Roomy (16 squares)",
  "sort": 1
}
```

Order:

```json
{
  "schemaVersion": 2,
  "ruleset": "5.5e",
  "kind": "order",
  "id": "bastion-order:craft",
  "name": "Craft",
  "nameKey": "craft",
  "sort": 1
}
```

Facility:

```json
{
  "schemaVersion": 2,
  "ruleset": "5.5e",
  "kind": "facility",
  "id": "bastion-facility:observatory",
  "name": "Observatory",
  "nameKey": "observatory",
  "facilityType": "special",
  "minimumLevel": 9,
  "prerequisite": null,
  "orders": ["Research"],
  "space": "Roomy",
  "hirelings": 1,
  "allowMultiple": false,
  "description": "A chamber equipped to study the movements and influence of celestial bodies."
}
```

Every bastion entry requires `kind` and `name`. Valid kinds are `"space"`, `"order"`, and `"facility"`.

---

# Character import

## Canonical envelope

```json
{
  "format": "beholden.character",
  "version": 1,
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "character": {
    "name": "Mira Vale",
    "className": "Fighter",
    "species": "Human",
    "level": 1,
    "hpMax": 12,
    "hpCurrent": 12,
    "ac": 16,
    "speed": 30,
    "strScore": 16,
    "dexScore": 12,
    "conScore": 14,
    "intScore": 10,
    "wisScore": 13,
    "chaScore": 8,
    "color": "#d4a72c",
    "characterData": {
      "classes": [
        {
          "id": "class_fighter",
          "classId": "c_fighter",
          "className": "Fighter",
          "level": 1,
          "subclass": null
        }
      ],
      "raceId": "r_human",
      "bgId": "bg_soldier",
      "hd": 10,
      "xp": 0,
      "proficiencies": {
        "skills": [],
        "expertise": [],
        "saves": [],
        "armor": [],
        "weapons": [],
        "tools": [],
        "languages": [],
        "spells": [],
        "invocations": [],
        "maneuvers": [],
        "plans": []
      },
      "inventory": [],
      "inventoryContainers": [],
      "creatures": [],
      "playerNotesList": [],
      "resources": [],
      "chosenCantrips": [],
      "chosenSpells": [],
      "preparedSpells": [],
      "chosenInvocations": [],
      "usedSpellSlots": {},
      "customResistances": [],
      "customImmunities": [],
      "customTools": [],
      "customLanguages": [],
      "exhaustion": 0,
      "concentrationSpell": null
    }
  }
}
```

The importer also accepts the character object without the outer envelope, but the canonical envelope is preferred. `format` and `version` identify the file for people and future tooling.

## Imported top-level character fields

| Field | Type | Required | Default / constraint |
|---|---|---:|---|
| `name` | non-empty string | yes | Character name |
| `playerName` | string | no | The server replaces it with the importing account's name |
| `className` | string | no | `""`; should match the primary class |
| `species` | string | no | `""` |
| `level` | integer | no | `1`, clamped to 1–20 |
| `hpMax` | integer | no | `0` minimum |
| `hpCurrent` | integer | no | Defaults to `hpMax`; keep from 0 through `hpMax` |
| `ac` | integer | no | `10` |
| `speed` | integer | no | `30` |
| `strScore` | integer \| null | no | 1–30 or `null` |
| `dexScore` | integer \| null | no | 1–30 or `null` |
| `conScore` | integer \| null | no | 1–30 or `null` |
| `intScore` | integer \| null | no | 1–30 or `null` |
| `wisScore` | integer \| null | no | 1–30 or `null` |
| `chaScore` | integer \| null | no | 1–30 or `null` |
| `color` | string | no | CSS color, normally hex |
| `characterData` | object \| null | no | Rich sheet details described below |

IDs, user IDs, campaign assignments, portrait URLs, timestamps, conditions, death saves, shared notes, and live overrides from an exported file are not used when creating the imported character. Beholden assigns a new character ID, owner, and live state.

The import normalizer may recalculate obvious summaries. For example, it can correct HP that is below its inferred class/level/Constitution baseline and infer some AC or speed values from recognizable inventory and features. Supply correct totals anyway.

## `characterData`

`characterData` is flexible, but the following keys are understood by the character sheet. Omit systems the character does not use or use their empty value.

### Identity and advancement

| Field | Type | Meaning |
|---|---|---|
| `classes` | class[] | One entry per class |
| `raceId` | string | Exact compendium species/race ID |
| `bgId` | string | Exact compendium background ID |
| `alignment`, `hair`, `skin`, `height`, `age`, `weight`, `gender` | string \| null | Optional biography |
| `hd` | number \| null | Primary hit-die size, e.g. `10`, not `"d10"` |
| `hitDiceCurrent` | number \| null | Unspent hit dice |
| `xp` | number | Current XP |
| `exhaustion` | number | Exhaustion level |

Class entry:

```json
{
  "id": "class_fighter",
  "classId": "c_fighter",
  "className": "Fighter",
  "level": 5,
  "subclass": "Champion"
}
```

`classId` must be an exact compendium ID. Canonical class, species, background, feat, spell, and item IDs follow:

```text
Class:       c_name_with_underscores
Race:        r_name_with_underscores
Background:  bg_name_with_underscores
Feat:        f_name_with_underscores
Spell:       s_name_with_underscores
Item:        i_name_with_underscores
```

Names are trimmed and lowercased; whitespace becomes underscores. Variant suffixes such as `[2024]` remain part of IDs. Exact IDs from the user's compendium are safer than derived IDs.

### Creator choices and feature references

These fields preserve choices used by Beholden's creator and level-up flows:

```text
abilityMethod
chosenOptionals
selectedFeatureNames
chosenClassFeatIds
chosenLevelUpFeats
chosenRaceFeatId
chosenBgOriginFeatId
chosenSkills
chosenClassLanguages
chosenFeatOptions
chosenFeatureChoices
chosenCantrips
chosenSpells
preparedSpells
chosenInvocations
extraFeatIds
extraFeatAbilityChoices
```

Only include these when their IDs and choice keys are known. Arbitrary names in ID fields do not create compendium content and can produce incomplete features. When exact references are unavailable, prefer a mechanically honest minimal character with explicit proficiencies, inventory, resources, and notes.

`preparedSpells` stores normalized spell names/keys used for preparation tracking. `chosenCantrips`, `chosenSpells`, and `chosenInvocations` normally store exact compendium IDs.

### Proficiencies

Provide all categories, even if some are empty:

```json
{
  "skills": [
    {
      "name": "Athletics",
      "source": "Fighter"
    }
  ],
  "expertise": [],
  "saves": [
    {
      "name": "Strength",
      "source": "Fighter"
    }
  ],
  "armor": [
    {
      "name": "Heavy Armor",
      "source": "Fighter"
    }
  ],
  "weapons": [
    {
      "name": "Martial Weapons",
      "source": "Fighter"
    }
  ],
  "tools": [],
  "languages": [
    {
      "name": "Common",
      "source": "Human"
    }
  ],
  "spells": [],
  "invocations": [],
  "maneuvers": [],
  "plans": []
}
```

Each tagged proficiency has:

| Field | Type | Required |
|---|---|---:|
| `name` | string | yes |
| `source` | string | yes |
| `id` | string | no |
| `ability` | `"str"` \| `"dex"` \| `"con"` \| `"int"` \| `"wis"` \| `"cha"` \| null | no |
| `sourceKey` | string \| null | no |

### Inventory

```json
{
  "id": "inv_longsword_1",
  "name": "Longsword",
  "quantity": 1,
  "equipped": true,
  "equipState": "mainhand-1h",
  "containerId": null,
  "source": "compendium",
  "itemId": "i_longsword",
  "rarity": null,
  "type": "Melee Weapon",
  "attunement": false,
  "attuned": false,
  "magic": false,
  "silvered": false,
  "equippable": true,
  "weight": 3,
  "value": 15,
  "dmg1": "1d8",
  "dmg2": "1d10",
  "dmgType": "S",
  "properties": ["M", "V"],
  "description": ""
}
```

Required inventory fields are `id`, `name`, `quantity`, and `equipped`. IDs need only be unique within this character. Valid `equipState` values are `"backpack"`, `"mainhand-1h"`, `"mainhand-2h"`, `"offhand"`, and `"worn"`.

Use `"source": "compendium"` and `itemId` only when the exact compendium item is known. For a custom possession, use `"source": "custom"` and omit `itemId`.

Optional inventory fields:

```text
proficiency, equipState, containerId, notes, source, itemId, rarity, type,
attunement, attuned, magic, silvered, equippable, weight, value, ac,
stealthDisadvantage, dmg1, dmg2, dmgType, properties, description,
chargesMax, charges
```

Inventory container:

```json
{
  "id": "container_backpack",
  "name": "Backpack",
  "ignoreWeight": false
}
```

Every non-null inventory `containerId` must match one of the character's container IDs.

### Resources

```json
{
  "key": "second_wind",
  "name": "Second Wind",
  "current": 1,
  "max": 1,
  "reset": "short",
  "restoreAmount": "all"
}
```

Each resource requires `key`, `name`, `current`, `max`, and `reset`. `restoreAmount` may be `"all"`, `"one"`, or a number. Use stable lowercase underscore keys. Keep `current` between `0` and `max`.

### Notes, creatures, and spell state

Player note:

```json
{
  "id": "note_backstory_1",
  "title": "Old Regimental Contact",
  "text": "Captain Elian Voss still owes Mira a favor."
}
```

Tracked creature:

```json
{
  "id": "creature_familiar_1",
  "monsterId": "m_owl",
  "name": "Owl",
  "label": "Sable",
  "friendly": true,
  "hpMax": 1,
  "hpCurrent": 1,
  "hpDetails": "1d4 - 1",
  "ac": 11,
  "acDetails": null,
  "notes": null
}
```

Spell and other live sheet fields:

| Field | Type |
|---|---|
| `chosenCantrips` | string[] |
| `chosenSpells` | string[] |
| `preparedSpells` | string[] |
| `chosenInvocations` | string[] |
| `usedSpellSlots` | object mapping slot level to number used |
| `concentrationSpell` | string \| null |
| `customResistances` | string[] |
| `customImmunities` | string[] |
| `customTools` | string[] |
| `customLanguages` | string[] |

Do not invent spell or feature IDs. Without the user's compendium/catalog context, omit those optional references. If the missing ID is essential to the request, ask for it before producing the final JSON.

## Character final check

- The file has one non-empty `character.name`.
- `level` is an integer from 1 through 20.
- Ability scores are integers from 1 through 30 or `null`.
- `hpCurrent` is between 0 and `hpMax`.
- Class levels add up to the top-level level.
- `className`, primary class entry, hit die, HP, saves, armor, and weapons agree.
- AC agrees with equipped armor, shield, Dexterity, and known bonuses.
- Every inventory item has a unique `id`, positive quantity, and valid container reference.
- Equipped items have plausible, non-conflicting equip states.
- Every resource has `0 <= current <= max`.
- Compendium ID fields contain exact or safely derived IDs, never prose placeholders.
- No campaign IDs, owner IDs, or fake database IDs are included.

---

# Recommended request wording

After giving this guide to the AI, use a request like:

> Using the Beholden guide, turn everything we designed in this conversation into a complete version 2 adventure import. The party is level 5 with four characters. Preserve our story decisions, add runnable DM notes and tactics where needed, embed native compendium batches for every new monster, item, or spell the adventure needs, validate every reference, and output only the final JSON code block.

For an item:

> Using the Beholden guide, turn our final item design into one importable Grand Schema Beholden Compendium `items` batch. Resolve any remaining wording into concise player-facing rules and output only the JSON.

For a character:

> Using the Beholden guide, turn our character into a Beholden character import. Use a minimal mechanically complete characterData object, do not invent unknown compendium IDs, check HP/AC/proficiencies/inventory, and output only the final JSON code block.
