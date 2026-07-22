import fs from "node:fs";

const file = new URL("../compendium/WotC_2024_only.json", import.meta.url);
const document = JSON.parse(fs.readFileSync(file, "utf8"));

const contributions = {
  c_artificer: { progression: "half", rounding: "up" },
  c_bard: { progression: "full" },
  c_cleric: { progression: "full" },
  c_druid: { progression: "full" },
  c_paladin: { progression: "half" },
  c_ranger: { progression: "half" },
  c_sorcerer: { progression: "full" },
  c_warlock: { progression: "pact" },
  c_wizard: { progression: "full" },
};

for (const cls of document.classes ?? []) {
  if (!cls.primaryAbility) throw new Error(`${cls.id} has no primaryAbility for its multiclass requirement.`);
  cls.multiclass = {
    requirements: { ability: cls.primaryAbility, minimum: 13 },
    ...(cls.multiclass ?? {}),
    ...(contributions[cls.id] ? { spellcasting: contributions[cls.id] } : {}),
  };

  for (const [subclassId, option] of Object.entries(cls.subclasses?.options ?? {})) {
    if (typeof option !== "object" || option == null || !option.spellcasting) continue;
    if (subclassId === "sc_fighter_eldritch_knight" || subclassId === "sc_rogue_arcane_trickster") {
      option.spellcasting.contribution = "third";
    }
  }
}

fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Populated multiclass rules for ${document.classes.length} classes.`);
