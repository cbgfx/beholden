export const CONDITIONS: Array<{ name: string; bullets: string[] }> = [
  {
    name: "Blinded",
    bullets: ["You can't see.", "Attack rolls against you have advantage.", "Your attack rolls have disadvantage."],
  },
  {
    name: "Charmed",
    bullets: [
      "You can't attack the charmer or target the charmer with harmful abilities.",
      "The charmer has advantage on social checks against you.",
    ],
  },
  { name: "Deafened", bullets: ["You can't hear."] },
  {
    name: "Frightened",
    bullets: [
      "You have disadvantage on ability checks and attacks while the source of fear is in line of sight.",
      "You can't willingly move closer to the source.",
    ],
  },
  {
    name: "Grappled",
    bullets: ["Speed becomes 0.", "Ends if the grappler is incapacitated or you are moved out of reach."],
  },
  { name: "Incapacitated", bullets: ["You can't take actions or reactions."] },
  {
    name: "Invisible",
    bullets: [
      "You are unseen without special senses or magic.",
      "Attack rolls against you have disadvantage.",
      "Your attack rolls have advantage.",
    ],
  },
  {
    name: "Paralyzed",
    bullets: [
      "You are incapacitated and can't move or speak.",
      "You automatically fail Strength and Dexterity saves.",
      "Attack rolls against you have advantage.",
      "Attacks from within 5 ft are critical hits if they hit.",
    ],
  },
  {
    name: "Petrified",
    bullets: [
      "You and what you're wearing/carrying become solid stone.",
      "You are incapacitated, can't move, and are unaware.",
      "You automatically fail Strength and Dexterity saves.",
      "You have resistance to all damage.",
      "You are immune to poison and disease (effects paused).",
    ],
  },
  { name: "Poisoned", bullets: ["You have disadvantage on attacks and ability checks."] },
  {
    name: "Prone",
    bullets: [
      "Your only movement option is to crawl unless you stand up.",
      "Attack rolls against you have advantage within 5 ft, otherwise disadvantage.",
      "Your attack rolls have disadvantage.",
    ],
  },
  {
    name: "Restrained",
    bullets: [
      "Speed becomes 0.",
      "Attack rolls against you have advantage.",
      "Your attack rolls have disadvantage.",
      "You have disadvantage on Dexterity saves.",
    ],
  },
  {
    name: "Stunned",
    bullets: [
      "You are incapacitated, can't move, and can speak only falteringly.",
      "You automatically fail Strength and Dexterity saves.",
      "Attack rolls against you have advantage.",
    ],
  },
  {
    name: "Unconscious",
    bullets: [
      "You are incapacitated, can't move or speak, and are unaware.",
      "You drop what you're holding and fall prone.",
      "You automatically fail Strength and Dexterity saves.",
      "Attack rolls against you have advantage.",
      "Attacks from within 5 ft are critical hits if they hit.",
    ],
  },
];

export const EXHAUSTION_2024: Array<{ level: number; effect: string }> = Array.from({ length: 10 }).map((_, i) => {
  const lvl = i + 1;
  const penalty = lvl * 2;
  return {
    level: lvl,
    effect: lvl === 10 ? "Death" : `-${penalty} to d20 Tests`,
  };
});

export const TRAVEL_PACE = [
  { pace: "Slow", mph: 2, perDay: 18, notes: "Can use Stealth." },
  { pace: "Normal", mph: 3, perDay: 24, notes: "" },
  { pace: "Fast", mph: 4, perDay: 30, notes: "-5 penalty to passive Perception." },
];

export const LIFESTYLE = [
  { name: "Wretched", cost: "—" },
  { name: "Squalid", cost: "1 sp" },
  { name: "Poor", cost: "2 sp" },
  { name: "Modest", cost: "1 gp" },
  { name: "Comfortable", cost: "2 gp" },
  { name: "Wealthy", cost: "4 gp" },
  { name: "Aristocratic", cost: "10 gp+" },
];

export const FOOD_LODGING = [
  { item: "Ale (mug)", cost: "4 cp" },
  { item: "Bread (loaf)", cost: "2 cp" },
  { item: "Cheese (wedge)", cost: "1 sp" },
  { item: "Squalid inn stay (per day)", cost: "7 cp" },
  { item: "Poor inn stay (per day)", cost: "1 sp" },
  { item: "Modest inn stay (per day)", cost: "5 sp" },
  { item: "Comfortable inn stay (per day)", cost: "8 sp" },
  { item: "Wealthy inn stay (per day)", cost: "2 gp" },
  { item: "Aristocratic inn stay (per day)", cost: "4 gp" },
  { item: "Squalid meal", cost: "1 cp" },
  { item: "Poor meal", cost: "2 cp" },
  { item: "Modest meal", cost: "1 sp" },
  { item: "Comfortable meal", cost: "2 sp" },
  { item: "Wealthy meal", cost: "3 sp" },
  { item: "Aristocratic meal", cost: "6 sp" },
  { item: "Common wine (bottle)", cost: "2 sp" },
  { item: "Fine wine (bottle)", cost: "10 gp" },
];
