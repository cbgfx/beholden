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

export const IconBulkDamage = (p: Omit<SvgIconProps, "svg">) => (
  <Icon
    svg={'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="m233.56 16.225-15.535 54.302-79.183-12.79-2.98 18.45L212.85 88.62l-14.92 52.163 17.968 5.14 11.028-38.546c92.558 14.84 177.404 26.687 273.004 16.824-78.98-39.333-166.495-51.603-258.832-66.368l10.43-36.467-17.97-5.14zm-68.695 120.443-13.482 12.953 69.644 72.493-59.63 34.428 9.347 16.19 44.098-25.46c83.234 86.485 160.743 164.186 267.683 231.242-48.682-97.16-128.987-177.16-212.025-263.375l40.176-23.198-9.346-16.19-63.625 36.734-72.84-75.816zm-87.11 13.424-17.82 5.646 20.942 66.094-53.99 13.613 4.57 18.125 38.824-9.79c25.36 79.632 50.276 151.825 99.097 222.02 2.31-80.818-23.148-155.34-48.488-234.78l37.794-9.528-4.57-18.125-55.08 13.887-21.28-67.162z"/></svg>'}
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
