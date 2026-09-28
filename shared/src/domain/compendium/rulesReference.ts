export const CONDITIONS: { name: string; bullets: string[] }[] = [
  { name: "Blinded", bullets: ["Can't see", "Attacks vs. you have advantage", "Your attacks have disadvantage"] },
  { name: "Charmed", bullets: ["Can't attack the charmer", "Charmer has advantage on social checks vs. you"] },
  { name: "Deafened", bullets: ["Can't hear", "Automatically fail checks requiring hearing"] },
  { name: "Exhaustion", bullets: ["-2 per level to all d20 rolls", "Speed halved at level 5", "Dead at level 10"] },
  { name: "Frightened", bullets: ["Disadvantage on checks/attacks while source is in sight", "Can't move toward source"] },
  { name: "Grappled", bullets: ["Speed 0", "Ends if grappler is incapacitated or target is moved out of reach"] },
  { name: "Incapacitated", bullets: ["Can't take actions or reactions"] },
  { name: "Invisible", bullets: ["Can't be seen without magic/special senses", "Attacks vs. you have disadvantage", "Your attacks have advantage"] },
  { name: "Paralyzed", bullets: ["Incapacitated", "Can't move or speak", "Auto-fail Str/Dex saves", "Attacks vs. you have advantage", "Hits within 5 ft. are crits"] },
  { name: "Petrified", bullets: ["Transformed to solid material", "Incapacitated, can't move/speak", "Unaware of surroundings", "Resistant to all damage"] },
  { name: "Poisoned", bullets: ["Disadvantage on attack rolls and ability checks"] },
  { name: "Prone", bullets: ["Move only by crawling (costs double)", "Disadvantage on attacks", "Melee attacks vs. you have advantage", "Ranged attacks vs. you have disadvantage"] },
  { name: "Restrained", bullets: ["Speed 0", "Attacks vs. you have advantage", "Your attacks have disadvantage", "Disadvantage on Dex saves"] },
  { name: "Stunned", bullets: ["Incapacitated", "Can't move", "Can only speak falteringly", "Auto-fail Str/Dex saves", "Attacks vs. you have advantage"] },
  { name: "Unconscious", bullets: ["Incapacitated, can't move or speak", "Drop what you're holding, fall prone", "Auto-fail Str/Dex saves", "Attacks vs. you have advantage", "Hits within 5 ft. are crits"] },
];

export const SIGHT_TYPES: { name: string; range: string; bullets: string[] }[] = [
  { name: "Darkvision", range: "Typically 60 ft.", bullets: ["See in dim light as bright", "See in darkness as dim light (grayscale)"] },
  { name: "Truesight", range: "Varies", bullets: ["See in magical darkness", "See invisible creatures", "See through illusions", "Detect shapechangers"] },
  { name: "Blindsight", range: "Varies", bullets: ["Perceive without sight within range", "Ignore invisible/darkness penalties"] },
  { name: "Tremorsense", range: "Varies", bullets: ["Detect vibrations through ground/water", "Can pinpoint location of moving creatures"] },
];

export const SCHOOLS_OF_MAGIC: { name: string; bullets: string[]; examples: string[] }[] = [
  { name: "Abjuration", bullets: ["Protective magic; wards and barriers."], examples: ["Shield", "Counterspell", "Banishment"] },
  { name: "Conjuration", bullets: ["Summon creatures or objects; transport."], examples: ["Misty Step", "Summon Beast", "Planar Ally"] },
  { name: "Divination", bullets: ["Reveal information; foresight."], examples: ["Detect Magic", "Scrying", "Foresight"] },
  { name: "Enchantment", bullets: ["Influence minds; charm and compel."], examples: ["Charm Person", "Hold Monster", "Suggestion"] },
  { name: "Evocation", bullets: ["Harness raw energy; elemental damage."], examples: ["Fireball", "Lightning Bolt", "Cure Wounds"] },
  { name: "Illusion", bullets: ["Deceive the senses; phantoms and disguise."], examples: ["Silent Image", "Invisibility", "Phantasmal Killer"] },
  { name: "Necromancy", bullets: ["Manipulate life force; undead."], examples: ["Animate Dead", "Inflict Wounds", "Finger of Death"] },
  { name: "Transmutation", bullets: ["Transform matter; alter properties."], examples: ["Polymorph", "Fly", "Stone Shape"] },
];

export const EXHAUSTION_2024: { level: string; effect: string }[] = [
  { level: "1", effect: "-2 to all d20 rolls" },
  { level: "2", effect: "-4 to all d20 rolls" },
  { level: "3", effect: "-6 to all d20 rolls" },
  { level: "4", effect: "-8 to all d20 rolls" },
  { level: "5", effect: "-10 to all d20 rolls; speed halved" },
  { level: "6-9", effect: "Continuing -2 per level" },
  { level: "10", effect: "Death" },
];

export const TRAVEL_PACE: { pace: string; mph: string; perDay: string; notes: string }[] = [
  { pace: "Fast", mph: "4 mph", perDay: "30 miles", notes: "-5 passive Perception" },
  { pace: "Normal", mph: "3 mph", perDay: "24 miles", notes: "--" },
  { pace: "Slow", mph: "2 mph", perDay: "18 miles", notes: "Can use Stealth" },
];

export const LIFESTYLE: { name: string; cost: string }[] = [
  { name: "Wretched", cost: "Free" },
  { name: "Squalid", cost: "1 sp/day" },
  { name: "Poor", cost: "2 sp/day" },
  { name: "Modest", cost: "1 gp/day" },
  { name: "Comfortable", cost: "2 gp/day" },
  { name: "Wealthy", cost: "4 gp/day" },
  { name: "Aristocratic", cost: "10 gp+/day" },
];

export const FOOD_LODGING: { item: string; cost: string }[] = [
  { item: "Ale (gallon)", cost: "2 sp" },
  { item: "Ale (mug)", cost: "4 cp" },
  { item: "Banquet (per person)", cost: "10 gp" },
  { item: "Bread (loaf)", cost: "2 cp" },
  { item: "Cheese (hunk)", cost: "1 sp" },
  { item: "Inn stay - Squalid", cost: "7 cp/day" },
  { item: "Inn stay - Poor", cost: "1 sp/day" },
  { item: "Inn stay - Modest", cost: "5 sp/day" },
  { item: "Inn stay - Comfortable", cost: "8 sp/day" },
  { item: "Inn stay - Wealthy", cost: "2 gp/day" },
  { item: "Inn stay - Aristocratic", cost: "4 gp/day" },
  { item: "Meals - Squalid", cost: "3 cp/day" },
  { item: "Meals - Poor", cost: "6 cp/day" },
  { item: "Meals - Modest", cost: "3 sp/day" },
  { item: "Meals - Comfortable", cost: "5 sp/day" },
  { item: "Meals - Wealthy", cost: "8 sp/day" },
  { item: "Meals - Aristocratic", cost: "2 gp/day" },
  { item: "Wine (common, pitcher)", cost: "2 sp" },
  { item: "Wine (fine, bottle)", cost: "10 gp" },
];
