import React from "react";
import type { Combatant, Player } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { CharacterSheetStats } from "@/components/CharacterSheet";
import {
  toFinite,
  parseSpeedVal,
  parseSpeedDisplay,
  parseSaves,
  buildMonsterInfoLines,
} from "@/utils/compendiumFormat";

export function useCharacterSheetStats(args: {
  combatant: Combatant | null;
  selectedMonster: MonsterDetail | null;
  player: Player | null;
}) {
  const { combatant, selectedMonster, player } = args;

  return React.useMemo((): CharacterSheetStats | null => {
    if (!combatant) return null;
    const overrides = combatant.overrides;

    const acBonus = Number(overrides.acBonus ?? 0) || 0;
    const hpMod = (() => {
      const v = overrides.hpMaxOverride;
      if (v == null) return 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    })();

    const hpMax = toFinite(Math.max(1, Number(combatant.hpMax ?? 1) + hpMod), 0);
    const hpCur = toFinite(combatant.hpCurrent ?? 0, 0);
    const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
    const ac = Math.max(0, toFinite(combatant.ac ?? 10, 10) + acBonus);

    const isMonster = combatant.baseType === "monster" || combatant.baseType === "inpc";

    // Fall back to selectedMonster itself if raw_json is absent —
    // mirrors MonsterStatblock's `m.raw_json ?? m` pattern.
    const detail = (selectedMonster?.raw_json ?? selectedMonster ?? {}) as Record<string, unknown>;
    const rawSpeed = detail["speed"] ?? selectedMonster?.speed;

    const speed = isMonster
      ? parseSpeedVal(rawSpeed)
      : (() => { const n = Number(player?.speed); return Number.isFinite(n) && n > 0 ? n : 30; })();

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

    const saves = isMonster ? parseSaves(detail["save"] ?? detail["saves"]) : undefined;
    const infoLines = isMonster ? buildMonsterInfoLines(detail) : [];

    return { ac, hpCur, hpMax, tempHp, speed, speedDisplay, abilities, saves, infoLines };
  }, [
    combatant?.id,
    combatant?.hpCurrent,
    combatant?.hpMax,
    combatant?.ac,
    combatant?.overrides,
    selectedMonster?.id,
    player,
  ]);
}
