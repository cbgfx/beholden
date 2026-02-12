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

// Core app icons (used across Campaign + Combat)
export const IconPlus = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z"/></svg>'}
    {...p}
  />
);

export const IconClose = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 1 0 1.41L13.41 12l4.89 4.88a1 1 0 1 1-1.41 1.42L12 13.41l-4.88 4.89a1 1 0 1 1-1.42-1.41L10.59 12 5.7 7.12a1 1 0 0 1 1.41-1.41L12 10.59l4.88-4.88a1 1 0 0 1 1.42 0z"/></svg>'}
    {...p}
  />
);

export const IconTrash = make("trash-can");
export const IconPencil = make("pencil");
export const IconShield = make("shield");
export const IconEncounter = make("crossed-swords");
export const IconNotes = make("notebook");
export const IconAdventure = make("treasure-map");
export const IconChest = make("chest");
export const IconPerson = make("barbute");
export const IconMonster = make("double-dragon");
export const IconDragon = IconMonster;
export const IconSkull = make("death-skull");
export const IconHeart = make("heart-beats");
export const IconDroplet = make("blood");
export const IconConditions = make("flower-twirl")
export const IconPlayer = make("barbute");

// Condition icons
export const IconBlinded = make("sight-disabled");
export const IconCharmed = make("chained-heart");
export const IconDeafened = make("hearing-disabled");
export const IconFrightened = make("spectre");
export const IconGrappled = make("grab");
export const IconHexed = make("nailed-head");
export const IconIncapacitated = make("static-guard");
export const IconInvisible = make("invisible");
export const IconMarked = make("headshot");
export const IconParalyzed = make("internal-injury");
export const IconPetrified = make("rock");
export const IconPoisoned = make("stoned-skull");
export const IconProne = make("back-pain");
export const IconRestrained = make("imprisoned");
export const IconStunned = make("knockout");
export const IconUnconscious = make("coma");
export const IconConcentration = make("psychic-waves");
export const IconHex = make("nailed-head");

// Misc stats icons
export const IconSpeed = make("walking-boot");
export const IconAC = IconShield;
export const IconHP = IconHeart;

export const IconLooseEncounter = make("shard-sword");
export const IconRest = make("campfire");
export const IconCompendium = make("book-pile");
export const IconSpells = make("spells");
export const IconCompendiumAlt = make("compendium");

export const IconEncounterRoster = make("three-friends");

export const IconInitiative = make("podium");

export const IconINPC = make("iron-mask");

export const IconPlay = make("play");
export const IconBuild = make("hammer-nails");

export const IconBlood = make("blood");

export const IconHeal = make("healing");

export const IconDead = make("death-skull");

export const IconExhaustion = make("sleepy");
