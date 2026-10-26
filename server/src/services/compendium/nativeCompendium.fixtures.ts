import { type NativeCompendiumCategory } from "./nativeCompendium.js";

export const samples: Record<NativeCompendiumCategory, Array<Record<string, unknown>>> = {
  "monsters": [
    {
      "id": "m_test_guardian",
      "ruleset": "5.5e",
      "name": "Test Guardian",
      "classification": {
        "size": "M",
        "type": "construct",
        "description": "Medium construct"
      },
      "challenge": {
        "rating": "2",
        "xp": 450
      },
      "armorClass": {
        "value": 15
      },
      "hitPoints": {
        "formula": "4d8 + 12"
      },
      "movement": {
        "walk": 30
      },
      "abilities": {
        "str": 14,
        "dex": 10,
        "con": 16,
        "int": 3,
        "wis": 10,
        "cha": 5
      },
      "actions": [
        {
          "id": "strike",
          "name": "Strike",
          "description": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) slashing damage.",
          "attack": {
            "toHit": 4,
            "reach": "5ft",
            "melee": true
          },
          "damage": {
            "roll": "1d8+2",
            "type": "slashing"
          }
        }
      ]
    }
  ],
  "items": [
    {
      "id": "i_test_blade",
      "ruleset": "5.5e",
      "name": "Test Blade",
      "type": "Melee Weapon",
      "rarity": "rare",
      "magical": true,
      "equippable": true,
      "weight": 3,
      "value": 100,
      "proficiency": "Martial Weapons",
      "weapon": {
        "damage": "1d8",
        "twoHandedDamage": "1d10",
        "damageType": "S",
        "properties": [
          "V"
        ]
      },
      "description": "Test rules."
    }
  ],
  "spells": [
    {
      "id": "s_test_spark",
      "ruleset": "5.5e",
      "name": "Test Spark",
      "level": 1,
      "school": "Evocation",
      "casting": {
        "time": "1 action",
        "range": "60 feet",
        "components": {
          "verbal": true,
          "somatic": true
        },
        "duration": {
          "description": "Instantaneous"
        }
      },
      "access": [
        "sl_wizard"
      ],
      "description": [
        "Test spell."
      ]
    }
  ],
  "classTalents": [
    {
      "ruleset": "5.5e",
      "id": "ct_invocation_test",
      "name": "Invocation: Test",
      "kind": "invocation",
      "description": [
        "A test class talent."
      ]
    }
  ],
  "classes": [
    {
      "id": "c_test",
      "ruleset": "5.5e",
      "name": "Test Class",
      "descriptions": [
        "A test class."
      ],
      "hitDie": 8,
      "spellLists": {
        "sl_wizard": "Wizard"
      },
      "proficiencies": {
        "savingThrows": [
          "int",
          "wis"
        ],
        "skills": {
          "choose": 2,
          "from": [
            "Arcana",
            "History"
          ]
        },
        "armor": [
          "Light Armor"
        ],
        "weapons": [
          "Simple Weapons"
        ]
      },
      "spellcasting": {
        "ability": "int"
      },
      "levels": [
        {
          "level": 1,
          "cantripsKnown": 2,
          "spellSlots": {
            "1": 2
          }
        }
      ]
    }
  ],
  "species": [
    {
      "id": "r_test",
      "ruleset": "5.5e",
      "name": "Test Species",
      "size": "M",
      "speed": 30,
      "traits": []
    }
  ],
  "backgrounds": [
    {
      "id": "bg_test",
      "ruleset": "5.5e",
      "name": "Test Background",
      "description": "A compact background.",
      "proficiencies": {}
    }
  ],
  "feats": [
    {
      "id": "f_test",
      "ruleset": "5.5e",
      "name": "Test Feat",
      "description": "Test feat."
    }
  ],
  "decks": [
    {
      "ruleset": "5.5e",
      "id": "deck:test:one",
      "deckName": "Test Deck",
      "deckKey": "test",
      "cardName": "One",
      "cardKey": "one",
      "text": "Test card.",
      "sort": 1
    }
  ],
  "bastions": [
    {
      "ruleset": "5.5e",
      "kind": "rules",
      "id": "bastion-rules:test",
      "name": "Test Rules",
      "specialFacilitySlots": [
        {
          "level": 5,
          "count": 2
        }
      ]
    },
    {
      "ruleset": "5.5e",
      "kind": "space",
      "id": "bastion-space:test",
      "name": "Test Space",
      "squares": 4,
      "sort": 1,
      "basicAdd": {
        "costGp": 500,
        "days": 20
      },
      "basicUpgrade": {
        "to": "test-space",
        "costGp": 500,
        "days": 25
      }
    },
    {
      "ruleset": "5.5e",
      "kind": "order",
      "id": "bastion-order:test",
      "name": "Test Order",
      "sort": 1
    },
    {
      "ruleset": "5.5e",
      "kind": "facility",
      "id": "bastion-facility:test",
      "name": "Test Facility",
      "facilityType": "special",
      "orders": [
        "Test Order"
      ],
      "description": "Test facility.",
      "upgrade": {
        "to": "vast",
        "costGp": 2000,
        "hirelingsDelta": 1,
        "summary": "Test upgrade."
      }
    }
  ]
};

export function batch(category: NativeCompendiumCategory, entries = samples[category]) {
  return {
    format: "beholden.compendium",
    schema: "grand",
    version: 2,
    category,
    exportedAt: "2026-06-28T00:00:00.000Z",
    entries,
  };
}
