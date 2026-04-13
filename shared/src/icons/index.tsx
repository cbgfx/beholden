import * as React from "react";
import { Icon, type SvgIconProps } from "./Icon";

const svgs = import.meta.glob("./svg/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function fromFile(file: string) {
  const key = `./svg/${file}.svg`;
  return (
    svgs[key] ??
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  );
}

function make(file: string) {
  return (p: Omit<SvgIconProps, "svg">) => <Icon svg={fromFile(file)} {...p} />;
}

export { Icon };
export type { SvgIconProps };

export const IconTrash = make("trash");
export const IconPencil = make("pencil");
export const IconShield = make("shield");
export const IconEncounter = make("encounter");
export const IconNotes = make("notes");
export const IconAdventure = make("adventure");
export const IconChest = make("chest");
export const IconMonster = make("monster");
export const IconWerewolf = make("werewolf");
export const IconDragon = IconMonster;
export const IconSkull = make("dead");
export const IconHeart = make("heart");
export const IconDroplet = make("blood");
export const IconAttack = make("attack");
export const IconConditions = make("conditions");
export const IconPlayer = make("person");
export const IconTargeted = make("targeted");

export const IconBlinded = make("blinded");
export const IconCharmed = make("charmed");
export const IconDeafened = make("deafened");
export const IconFrightened = make("frightened");
export const IconGrappled = make("grappled");
export const IconHexed = make("hexed");
export const IconIncapacitated = make("incapacitated");
export const IconInvisible = make("invisible");
export const IconMarked = make("marked");
export const IconParalyzed = make("paralyzed");
export const IconPetrified = make("petrified");
export const IconPoisoned = make("poisoned");
export const IconProne = make("prone");
export const IconRestrained = make("restrained");
export const IconStunned = make("stunned");
export const IconUnconscious = make("unconscious");
export const IconConcentration = make("concentration");
export const IconDisadvantage = make("disadvantage");
export const IconHex = make("hexed");
export const IconExhaustion = make("exhaustion");

export const IconSpeed = make("speed");
export const IconAC = IconShield;
export const IconHP = IconHeart;

export const IconRest = make("rest");
export const IconCompendium = make("compendium-alt");
export const IconSpells = make("spells");
export const IconCompendiumAlt = make("compendium-alt");
export const IconEncounterRoster = make("encounter-roster");
export const IconInitiative = make("initiative");
export const IconINPC = make("inpc");
export const IconPlay = make("play");
export const IconBuild = make("build");
export const IconBastions = make("bastions");
export const IconBlood = make("blood");
export const IconHeal = make("heal");
export const IconDead = make("dead");
export const IconDice = make("dice");

export const conditionIconSvgByKey: Record<string, string> = {
  blinded: fromFile("blinded"),
  charmed: fromFile("charmed"),
  deafened: fromFile("deafened"),
  frightened: fromFile("frightened"),
  grappled: fromFile("grappled"),
  incapacitated: fromFile("incapacitated"),
  invisible: fromFile("invisible"),
  paralyzed: fromFile("paralyzed"),
  petrified: fromFile("petrified"),
  poisoned: fromFile("poisoned"),
  hexed: fromFile("hexed"),
  marked: fromFile("marked"),
  prone: fromFile("prone"),
  restrained: fromFile("restrained"),
  stunned: fromFile("stunned"),
  unconscious: fromFile("unconscious"),
  concentration: fromFile("concentration"),
  disadvantage: fromFile("disadvantage"),
  exhaustion: fromFile("exhaustion"),
  rage: fromFile("attack"),
  hex: fromFile("hexed"),
};

export const conditionIconByKey = {
  blinded: IconBlinded,
  charmed: IconCharmed,
  deafened: IconDeafened,
  frightened: IconFrightened,
  grappled: IconGrappled,
  incapacitated: IconIncapacitated,
  invisible: IconInvisible,
  paralyzed: IconParalyzed,
  petrified: IconPetrified,
  poisoned: IconPoisoned,
  prone: IconProne,
  restrained: IconRestrained,
  stunned: IconStunned,
  unconscious: IconUnconscious,
  concentration: IconConcentration,
  disadvantage: IconDisadvantage,
  hexed: IconHex,
  marked: IconMarked,
  exhaustion: IconExhaustion,
  hex: IconHex,
} as const;

export function IconConditionByKey({ condKey, ...p }: Omit<SvgIconProps, "svg"> & { condKey: string }) {
  const svg = conditionIconSvgByKey[condKey];
  return svg ? <Icon svg={svg} {...p} /> : null;
}
