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
export const IconWorldAction = make("world-action");
export const IconNotes = make("notes");
export const IconAdventure = make("adventure");
export const IconChest = make("chest");
export const IconMonster = make("monster");
export const IconWerewolf = make("werewolf");
export const IconSkull = make("dead");
export const IconHeart = make("heart");
export const IconAttack = make("attack");
export const IconConditions = make("conditions");
export const IconPlayer = make("person");
export const IconTargeted = make("targeted");

export const IconBlinded = make("blinded");
export const IconCharmed = make("charmed");
export const IconDeafened = make("deafened");
export const IconFrightened = make("frightened");
export const IconGrappled = make("grappled");
export const IconIncapacitated = make("incapacitated");
export const IconInvisible = make("invisible");
export const IconMarked = make("marked");
export const IconParalyzed = make("paralyzed");
export const IconPetrified = make("petrified");
export const IconPoisoned = make("poisoned");
export const IconProne = make("prone");
export const IconRestrained = make("restrained");
export const IconSlow = make("speed");
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
export const IconSpells = make("spells");
export const IconCompendiumAlt = make("compendium-alt");
export const IconEncounterRoster = make("encounter-roster");
export const IconInitiative = make("initiative");
export const IconINPC = make("inpc");
export const IconPlay = make("play");
export const IconBuild = make("build");
export const IconBastions = make("bastions");
export const IconHeal = make("heal");
export const IconDice = make("dice");
export const IconAI = make("artificial-intelligence");
export const IconWeight = make("weight");

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
  slow: fromFile("speed"),
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
  slow: IconSlow,
  stunned: IconStunned,
  unconscious: IconUnconscious,
  concentration: IconConcentration,
  disadvantage: IconDisadvantage,
  hexed: IconHex,
  marked: IconMarked,
  exhaustion: IconExhaustion,
  rage: IconAttack,
  hex: IconHex,
} as const;

export function IconConditionByKey({ condKey, ...p }: Omit<SvgIconProps, "svg"> & { condKey: string }) {
  const svg = conditionIconSvgByKey[condKey];
  return svg ? <Icon svg={svg} {...p} /> : null;
}

const DOWNLOAD_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const IMPORT_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
const INSPIRATION_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M255.9 19.77C241.5 109.6 229.4 163 196.2 196.2c-33.2 33.2-86.6 45.3-176.43 59.7C109.6 270.3 163 282.4 196.2 315.7c33.2 33.2 45.3 86.6 59.7 176.5 14.4-89.9 26.5-143.3 59.7-176.6 33.3-33.2 86.7-45.3 176.6-59.7-89.9-14.4-143.3-26.5-176.5-59.7-33.3-33.2-45.4-86.6-59.8-176.43zM423 89c-45.8 33.1-81 56.9-112.4 70.2 5.1 9.4 11 17.4 17.8 24.2 6.8 6.8 14.8 12.7 24.3 17.9 13.4-31.4 37.2-66.6 70.3-112.3zm-333.94.06C122.2 134.8 145.9 169.9 159.2 201.2c9.4-5.1 17.4-11 24.2-17.8 6.8-6.8 12.7-14.8 17.8-24.2-31.3-13.3-66.4-37-112.14-70.14zM352.7 310.5c-9.5 5.2-17.5 11.1-24.3 17.9-6.8 6.8-12.7 14.8-17.9 24.3C342 366 377.2 389.8 423 423c-33.2-45.8-57-81-70.3-112.5zm-193.5.1C145.9 342 122.1 377.2 89 423c45.7-33.1 80.9-56.9 112.3-70.3-5.2-9.5-11.1-17.5-17.9-24.3-6.8-6.8-14.8-12.7-24.2-17.8z"/></svg>';

export function IconDownload(p: Omit<SvgIconProps, "svg">) {
  return <Icon svg={DOWNLOAD_SVG} {...p} />;
}
export function IconImport(p: Omit<SvgIconProps, "svg">) {
  return <Icon svg={IMPORT_SVG} {...p} />;
}
export function IconInspiration(p: Omit<SvgIconProps, "svg">) {
  return <Icon svg={INSPIRATION_SVG} {...p} />;
}
