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

## Choose the right output

| Request | Output | Can be uploaded directly? |
|---|---|---|
| Adventure, encounter set, adventure notes, or adventure treasure | Adventure import JSON with embedded compendium batches | Yes, through **Import Adventure** |
| Player-owned character | Character import JSON | Yes, through **My Characters → Import** |
| Monsters, items, spells, classes, species, backgrounds, feats, decks, or bastions | Category-specific Beholden Compendium JSON | Yes, through **Compendium → Import Beholden JSON** |
| Custom treasure used only by one adventure | Put it in the adventure's `treasure` array | Yes, as part of the adventure |

Beholden JSON is the canonical compendium language. Legacy XML is never imported into the live compendium. A stateless converter reads one XML file and downloads one complete Beholden JSON bundle; that resulting JSON may then be imported through the native Beholden importer.

Adventure version 2 may embed those exact native batches in its `compendium` array. Embedded entries are imported first and replace matching compendium IDs, so an adventure can carry every monster, item, spell, or other rules entry it needs.

---

# Native Beholden Compendium

Normal editable exports contain exactly one category. This keeps monsters, items, spells, and the other catalogs independently manageable. The legacy XML converter is the exception: it produces one bundle containing all non-empty categories found in that XML.

## Canonical batch envelope

```json
{
  "format": "beholden.compendium",
  "version": 2,
  "category": "monsters",
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "entries": []
}
```

Valid categories are:

```text
monsters, items, spells, classes, species, backgrounds, feats, decks, bastions
```

Rules:

- `format` must be exactly `"beholden.compendium"`.
- `version` must be the number `2`.
- `category` must contain one valid category and every entry must belong to it.
- `entries` must be an array of objects.
- Decks and bastions contain `"schemaVersion": 2`.
  All other categories omit per-entry `schemaVersion`.
- Imports always overwrite an existing row with the same `id`.
- Every entry must contain a non-empty stable `id`. Version 2 never invents or repairs missing IDs.
- Entries use one explicit canonical shape. Unknown or legacy-shaped fields are rejected rather than guessed.
- Never mix categories in one batch. Produce multiple files or multiple embedded batches instead.

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

## Complete bundle envelope

The native importer also accepts a multi-category bundle. The legacy XML converter always produces this shape as one downloaded JSON file:

```json
{
  "format": "beholden.compendium",
  "version": 2,
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "batches": [
    {
      "category": "monsters",
      "entries": []
    },
    {
      "category": "items",
      "entries": []
    }
  ]
}
```

Each object in `batches` has exactly one valid `category` and its corresponding `entries`. Empty categories are normally omitted. Importing a bundle is atomic: all batches succeed together or none are applied.

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

For XML-imported monsters, Beholden normally derives the ID as:

```text
m_ + trimmed monster name converted to lowercase, with runs of whitespace collapsed to one space
```

Examples:

```text
Animated Armor  →  m_animated armor
Adult Red Dragon  →  m_adult red dragon
Goblin [2024]  →  m_goblin [2024]
```

Spaces and punctuation remain in monster IDs. Do not change spaces to underscores. Compendiums imported from other sources can use different IDs, so an exported ID or an ID supplied by the user is always more reliable.

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

For XML-imported items, IDs normally use `i_` followed by the lowercase normalized name with spaces changed to underscores, for example `i_potion_of_healing`. Use `"compendium"` only if the exact destination item ID is known. Otherwise use `"custom"` and `null`.

## Complete adventure example

```json
{
  "format": "beholden.adventure",
  "version": 2,
  "compendium": [
    {
      "format": "beholden.compendium",
      "version": 2,
      "category": "monsters",
      "exportedAt": "2026-06-28T00:00:00.000Z",
      "entries": [
        {
          "id": "m_orrery_guardian",
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
            "numeric": 1,
            "xp": 200
          },
          "armorClass": {
            "value": 18,
            "source": "brass plating"
          },
          "hitPoints": {
            "average": 33,
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
                "melee": true,
                "damage": "1d6+2",
                "damageType": "bludgeoning"
              },
              "attacks": ["Bludgeoning Damage|+4|1d6+2"]
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
- every embedded compendium object is a valid version 2 category batch;
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
  "version": 2,
  "category": "items",
  "exportedAt": "2026-06-28T00:00:00.000Z",
  "entries": [
    {
      "id": "i_gloamglass_dagger",
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
        {
          "category": "bonus",
          "value": "+1 bonus to attack and damage rolls"
        }
      ],
      "description": [
        "You gain a +1 bonus to attack and damage rolls made with this magic weapon.",
        "While holding the dagger in dim light or darkness, you can take the Hide action as a bonus action."
      ]
    }
  ]
}
```

Version 2 item entries are sparse: omit defaults, nulls, empty arrays, and inapplicable armor/weapon blocks. Older verbose V2 exports remain importable.

| Field | Type | Guidance |
|---|---|---|
| `name` | non-empty string | Required; Beholden creates an ID from it |
| `type` | non-empty string | Item category; the filter key is derived automatically |
| `rarity` | non-empty string | Item rarity |
| `magical` | literal `true` | Omit for nonmagical items |
| `attunement` | `true` or string | Omit when not required; use a string for requirements |
| `equippable` | literal `true` | Omit when false |
| `weight`, `value` | nonnegative number | Omit when unknown |
| `proficiency` | string | Omit when none |
| `armor` | object | Optional `ac`, `stealthDisadvantage: true`, and `strength` |
| `weapon` | object | Damage formulas, damage type, range, and properties |
| `detail` | string | Keep only subtype/detail text not derivable from type, rarity, or attunement |
| `modifiers` | object[] | Omit when empty; each object has `category` and `value` |
| `rolls` | object[] | Omit when empty; each has `formula` and optional `description` |
| `description` | string or string[] | Prefer a string; use an array only for separate blocks |

Known item types:

```text
Light Armor, Medium Armor, Heavy Armor, Shield,
Melee Weapon, Ranged Weapon, Ammunition,
Potion, Scroll, Wand, Rod, Staff, Ring,
Wondrous Item, Adventuring Gear, Currency, Other
```

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

The app's New Item form is a convenience editor; exported native files use the sparse version 2 shape above.

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

Wrap each entry below in the canonical batch envelope and set the matching `category`. Use exactly the documented fields: version 2 rejects unknown additions and legacy aliases.

## Spells

```json
{
  "id": "s_starfall_lance",
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
  "classes": ["Sorcerer", "Wizard"],
  "rolls": [
    {
      "description": "Radiant Damage",
      "scaling": "slot_level",
      "level": 3,
      "formula": "6d6"
    },
    {
      "description": "Radiant Damage",
      "scaling": "slot_level",
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
`classes` contains class names only—never `School: ...` metadata. Put lookup
groups such as `Ritual Caster`, `Touch Spells`, or `Eldritch Invocations` in
`tags`. Casting time, range, components, duration, concentration, and dice
formulas are explicit and are never inferred from rules prose. Omit false
booleans, absent values, and empty arrays. A material component is `true` when
it has no useful description, or its description string when it does.
Concentration and ritual are written only as `true`. A roll's optional
`scaling` is `character_level` or `slot_level`; its optional `level` is 0-20.

## Classes

```json
{
  "id": "c_wayfinder",
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
  "name": "Emberkin",
  "size": "M",
  "speed": 30,
  "resistances": ["fire"],
  "vision": [],
  "traits": [
    {
      "id": "fire_resistance",
      "name": "Fire Resistance",
      "description": "You have resistance to fire damage."
    }
  ]
}
```

`name`, `speed`, `vision`, and `traits` are required. Trait objects use `id`, `name`, and `description`. Omit nulls, empty collections, and absent optionals (`source`, `size`, `spellcastingAbility`, `resistances`, `choices`).

## Backgrounds

```json
{
  "id": "bg_stargazer",
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
          { "kind": "item", "name": "Star Chart", "quantity": 1 },
          { "kind": "item", "name": "Spyglass", "quantity": 1 },
          { "kind": "item", "name": "Traveler's Clothes", "quantity": 1 },
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

The surrounding batch already declares V2, so backgrounds do not repeat
`schemaVersion`. Fixed proficiencies are arrays; use `{ "choose": N, "from":
[...] }` only for real choices. Omit nulls, empty collections, and zero-valued
defaults. Equipment with structured options does not repeat its prose list.
Fixed feats include their parsed mechanics because character creation consumes
them for automation.

## Feats

```json
{
  "id": "f_orbit_step",
  "name": "Orbit Step",
  "category": "General",
  "prerequisite": "Level 4+",
  "description": "Immediately after you take the Dash action, you can teleport up to 10 feet to an unoccupied space you can see.",
  "resolution": "manual",
  "resolutionNotes": ["Resolve the Dash trigger and teleport manually."]
}
```

`name` is required. Write deterministic rules text: specify trigger, action cost, range, target, duration, limits, and reset timing when applicable.

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

`classId` must be an exact compendium ID. XML-imported class, race, background, feat, spell, and item IDs normally follow:

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

> Using the Beholden guide, turn our final item design into one importable version 2 Beholden Compendium `items` batch. Resolve any remaining wording into concise player-facing rules and output only the JSON.

For a character:

> Using the Beholden guide, turn our character into a Beholden character import. Use a minimal mechanically complete characterData object, do not invent unknown compendium IDs, check HP/AC/proficiencies/inventory, and output only the final JSON code block.
