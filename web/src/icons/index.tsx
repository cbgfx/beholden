import * as React from "react";
import { Icon, type SvgIconProps } from "@/icons/Icon";

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
export const IconDownload = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'}
    {...p}
  />
);

export const IconCamera = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'}
    {...p}
  />
);

export const IconUsers = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'}
    {...p}
  />
);

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

export const IconTrash = make("trash");
export const IconPencil = make("pencil");
export const IconShield = make("shield");
export const IconEncounter = make("encounter");
export const IconNotes = make("notes");
export const IconAdventure = make("adventure");
export const IconChest = make("chest");
export const IconMonster = make("monster");
export const IconDragon = IconMonster;
export const IconSkull = make("dead");
export const IconHeart = make("heart");
export const IconDroplet = make("blood");
export const IconAttack = make("attack");
export const IconConditions = make("conditions")
export const IconPlayer = make("person");

// Condition icons
export const IconBlinded = make("blinded");
export const IconCharmed = make("charmed");
export const IconDeafened = make("deafened");
export const IconFrightened = make("frightened");
export const IconGrappled = make("grappled");
export const IconHexed = make("hexed");
export const IconIncapacitated = make("incapacitated");
export const IconInvisible = make("invisible");
export const IconMarked = make("marked");
export const IconTargeted = make("targeted");
export const IconParalyzed = make("paralyzed");
export const IconPetrified = make("petrified");
export const IconPoisoned = make("poisoned");
export const IconProne = make("prone");
export const IconRestrained = make("restrained");
export const IconStunned = make("stunned");
export const IconUnconscious = make("unconscious");
export const IconConcentration = make("concentration");
export const IconHex = make("hexed");

// Misc stats icons
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

export const IconBlood = make("blood");

export const IconHeal = make("heal");

export const IconDead = make("dead");

export const IconExhaustion = make("exhaustion");

export const IconDice = make("dice");

export const IconImport = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'}
    {...p}
  />
);

export const IconCopy = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'}
    {...p}
  />
);
