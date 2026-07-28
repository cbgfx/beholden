import React from "react";
import type { EncounterActor, CampaignCharacter } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { CharacterSheetStats } from "@/components/CharacterSheet";
import {
  toFinite,
  parseSpeedVal,
  parseSpeedDisplay,
  parseSaves,
  buildMonsterInfoLines,
} from "@/utils/compendiumFormat";
import { hasZeroSpeedCondition, SLOW_SPEED_PENALTY } from "@beholden/shared/domain";

/** Zeroes every movement mode (walk/fly/swim/climb/burrow) in a monster's raw speed value —
 * used when a condition sets Speed to 0, so e.g. a flying creature that's Paralyzed doesn't
 * still show its fly speed. The server pre-formats monster speed as a display string (e.g.
 * "walk 0 ft., fly 40 ft. (hover)"), so the common case is zeroing the numbers inside that
 * string rather than an object of raw mode values — but the object/number shapes are handled
 * too, since parseSpeedVal/parseSpeedDisplay themselves accept any of the three. */
function zeroMonsterSpeed(rawSpeed: unknown): unknown {
  if (rawSpeed == null) return rawSpeed;
  if (typeof rawSpeed === "number") return 0;
  if (typeof rawSpeed === "string") return rawSpeed.replace(/\d+(?=\s*ft\.)/gi, "0");
  if (typeof rawSpeed === "object") {
    return Object.fromEntries(
      Object.entries(rawSpeed as Record<string, unknown>).map(([mode, value]) => [
        mode,
        typeof value === "number" ? 0 : typeof value === "string" ? value.replace(/\d+/g, "0") : value,
      ])
    );
  }
  return rawSpeed;
}

export function useCharacterSheetStats(args: {
  combatant: EncounterActor | null;
  selectedMonster: MonsterDetail | null;
  player: CampaignCharacter | null;
}) {
  const { combatant, selectedMonster, player } = args;

  return React.useMemo((): CharacterSheetStats | null => {
    if (!combatant) return null;
    const overrides = combatant.overrides;

    const acBonus = Number(overrides.acBonus ?? 0) || 0;
    const hpMod = (() => {
      const v = overrides.hpMaxBonus;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    })();

    const hpMax = toFinite(Math.max(1, Number(combatant.hpMax ?? 1) + hpMod), 0);
    const hpCur = toFinite(combatant.hpCurrent ?? 0, 0);
    const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
    const baseAc = combatant.baseType === "player"
      ? toFinite(player?.ac ?? combatant.ac ?? 10, 10)
      : toFinite(combatant.ac ?? 10, 10);
    const ac = Math.max(0, baseAc + acBonus);

    const isMonster = combatant.baseType === "monster" || combatant.baseType === "inpc";

    // Fall back to selectedMonster itself if raw_json is absent —
    // mirrors MonsterStatblock's `m.raw_json ?? m` pattern.
    const detail = (selectedMonster?.raw_json ?? selectedMonster ?? {}) as Record<string, unknown>;
    const rawSpeedBase = detail["speed"] ?? selectedMonster?.speed;

    const conditions = combatant.conditions ?? [];
    const zeroSpeed = hasZeroSpeedCondition(conditions);
    const slowed = !zeroSpeed && conditions.some((condition) => condition.key === "slow");
    const rawSpeed = zeroSpeed ? zeroMonsterSpeed(rawSpeedBase) : rawSpeedBase;

    const speed = isMonster
      ? parseSpeedVal(rawSpeed)
      : zeroSpeed
        ? 0
        : (() => {
            const n = Number(player?.speed);
            const base = Number.isFinite(n) && n >= 0 ? n : 30;
            return slowed ? Math.max(0, base - SLOW_SPEED_PENALTY) : base;
          })();

    const speedDisplay = isMonster
      ? parseSpeedDisplay(rawSpeed)
      : `${speed} ft.`;

    const abilities = isMonster
      ? {
          str: Number(selectedMonster?.str ?? detail["str"] ?? 10),
          dex: Number(selectedMonster?.dex ?? detail["dex"] ?? 10),
          con: Number(selectedMonster?.con ?? detail["con"] ?? 10),
          int: Number(selectedMonster?.int ?? detail["int"] ?? 10),
          wis: Number(selectedMonster?.wis ?? detail["wis"] ?? 10),
          cha: Number(selectedMonster?.cha ?? detail["cha"] ?? 10),
        } as const
      : {
          str: Number(player?.str ?? 10),
          dex: Number(player?.dex ?? 10),
          con: Number(player?.con ?? 10),
          int: Number(player?.int ?? 10),
          wis: Number(player?.wis ?? 10),
          cha: Number(player?.cha ?? 10),
        } as const;

    const proficiencies = detail["proficiencies"] as { savingThrows?: unknown } | undefined;
    const saves = isMonster ? parseSaves(proficiencies?.savingThrows) : undefined;
    const infoLines = isMonster ? buildMonsterInfoLines(detail) : [];

    return { ac, hpCur, hpMax, tempHp, speed, speedDisplay, abilities, saves, infoLines };
  }, [combatant, selectedMonster, player]);
}
