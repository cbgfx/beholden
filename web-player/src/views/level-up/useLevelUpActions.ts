import React from "react";
import { rollDiceExpr } from "@/lib/dice";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import type { HpChoice } from "@/views/level-up/LevelUpTypes";

type SpellEntry = { id: string; name: string; level?: number | null };

export function useLevelUpActions(args: {
  hd: number;
  conMod: number;
  classCantrips: SpellEntry[];
  classSpells: SpellEntry[];
  classInvocations: SpellEntry[];
  lockedCantripIds: Set<string>;
  lockedSpellIds: Set<string>;
  lockedInvocationIds: Set<string>;
  preparedSpellProgressionGrantedKeys: Set<string>;
  maxSpellLevel: number;
  allowedInvocationIds: Set<string>;
  setHpChoice: React.Dispatch<React.SetStateAction<HpChoice>>;
  setRolledHp: React.Dispatch<React.SetStateAction<number | null>>;
  setManualHp: React.Dispatch<React.SetStateAction<string>>;
  setAsiStats: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setAsiMode: React.Dispatch<React.SetStateAction<"asi" | "feat" | null>>;
}) {
  const {
    hd,
    conMod,
    classCantrips,
    classSpells,
    classInvocations,
    lockedCantripIds,
    lockedSpellIds,
    lockedInvocationIds,
    preparedSpellProgressionGrantedKeys,
    maxSpellLevel,
    allowedInvocationIds,
    setHpChoice,
    setRolledHp,
    setManualHp,
    setAsiStats,
    setAsiMode,
  } = args;

  const availableCantripChoices = React.useMemo(
    () =>
      classCantrips.filter((spell) =>
        !lockedCantripIds.has(spell.id)
        && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name)),
      ),
    [classCantrips, lockedCantripIds, preparedSpellProgressionGrantedKeys],
  );

  const availableSpellChoices = React.useMemo(
    () =>
      classSpells.filter((spell) =>
        !lockedSpellIds.has(spell.id)
        && !preparedSpellProgressionGrantedKeys.has(normalizeSpellTrackingKey(spell.name))
        && Number(spell.level ?? 0) > 0
        && Number(spell.level ?? 0) <= maxSpellLevel,
      ),
    [classSpells, lockedSpellIds, maxSpellLevel, preparedSpellProgressionGrantedKeys],
  );

  const availableInvocationChoices = React.useMemo(
    () =>
      classInvocations.filter(
        (invocation) => !lockedInvocationIds.has(invocation.id) && allowedInvocationIds.has(invocation.id),
      ),
    [allowedInvocationIds, classInvocations, lockedInvocationIds],
  );

  const rollHp = React.useCallback(() => {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }, [conMod, hd, setHpChoice, setRolledHp]);

  const toggleAsiPoint = React.useCallback((key: string, asiMode: "asi" | "feat" | null) => {
    if (!asiMode || asiMode === "feat") return;
    setAsiStats((prev) => {
      const current = prev[key] ?? 0;
      const totalAssigned = Object.values(prev).reduce((sum, value) => sum + value, 0);
      const next = { ...prev };
      if (current >= 2) {
        next[key] = current - 1;
      } else if (current > 0 && totalAssigned >= 2) {
        if (current === 1) delete next[key];
        else next[key] = current - 1;
      } else if (totalAssigned < 2) {
        next[key] = current + 1;
      }
      return next;
    });
  }, [setAsiStats]);

  const clearAsi = React.useCallback(() => {
    setAsiStats({});
    setAsiMode(null);
  }, [setAsiMode, setAsiStats]);

  const toggleSelection = React.useCallback(
    (
      id: string,
      _chosen: string[],
      apply: (updater: string[] | ((current: string[]) => string[])) => void,
      max: number,
    ) => {
      apply((prev) => {
        const has = prev.includes(id);
        if (has) return prev.filter((entry) => entry !== id);
        if (prev.length >= max) return prev;
        return [...prev, id];
      });
    },
    [],
  );

  const toggleMultiChoice = React.useCallback(
    (
      choiceKey: string,
      option: string,
      count: number,
      setSelections: React.Dispatch<React.SetStateAction<Record<string, string[]>>>,
    ) => {
      setSelections((prev) => {
        const current = prev[choiceKey] ?? [];
        const next = current.includes(option)
          ? current.filter((entry) => entry !== option)
          : current.length < count
            ? [...current, option]
            : current;
        return { ...prev, [choiceKey]: next };
      });
    },
    [],
  );

  return {
    availableCantripChoices,
    availableSpellChoices,
    availableInvocationChoices,
    rollHp,
    toggleAsiPoint,
    clearAsi,
    toggleSelection,
    toggleMultiChoice,
    resetHpToAverage: () => {
      setHpChoice("average");
      setRolledHp(null);
      setManualHp("");
    },
    chooseHpRoll: () => {
      setManualHp("");
      rollHp();
    },
    chooseHpManual: () => {
      setHpChoice("manual");
      setRolledHp(null);
    },
  };
}
