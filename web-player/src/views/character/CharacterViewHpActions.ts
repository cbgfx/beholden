import type React from "react";
import { api, jsonInit } from "@/services/api";
import { hasDiceTerm, rollDiceExpr } from "@/lib/dice";
import type { Character, PolymorphConditionData, SheetOverrides } from "@/views/character/CharacterViewHelpers";

export function buildCharacterHpActions(args: {
  hpAmount: string;
  setHpAmount: React.Dispatch<React.SetStateAction<string>>;
  setLastRoll: React.Dispatch<React.SetStateAction<number | null>>;
  flashRef: React.MutableRefObject<number | null>;
  hpInputRef: React.RefObject<HTMLInputElement | null>;
  setHpError: React.Dispatch<React.SetStateAction<string | null>>;
  setHpSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setConcentrationAlert: React.Dispatch<React.SetStateAction<{ dc: number } | null>>;
  char: Character;
  setChar: React.Dispatch<React.SetStateAction<Character | null>>;
  effectiveHpMax: number;
  overrides: SheetOverrides;
  polymorphCondition: PolymorphConditionData | null;
  revertPolymorph: (overflowDamage?: number) => Promise<void>;
}) {
  const {
    hpAmount,
    setHpAmount,
    setLastRoll,
    flashRef,
    hpInputRef,
    setHpError,
    setHpSaving,
    setConcentrationAlert,
    char,
    setChar,
    effectiveHpMax,
    overrides,
    polymorphCondition,
    revertPolymorph,
  } = args;

  const rollAndFlash = (): number => {
    const result = rollDiceExpr(hpAmount.trim());
    if (hasDiceTerm(hpAmount)) {
      setHpAmount(String(result));
      setLastRoll(result);
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setLastRoll(null), 1600);
      hpInputRef.current?.focus();
    }
    return result;
  };

  const applyHp = async (kind: "damage" | "heal", resolvedAmt?: number) => {
    const amt = resolvedAmt ?? rollDiceExpr(hpAmount.trim());
    if (amt <= 0) {
      setHpError("Enter a number > 0  (e.g. 8, 2d6+3, +5)");
      return;
    }
    setHpError(null);
    setHpSaving(true);
    try {
      if (kind === "heal") {
        const newHp = Math.min(char.hpCurrent + amt, effectiveHpMax);
        await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
        setChar((prev) => prev ? { ...prev, hpCurrent: newHp } : prev);
      } else {
        const currentTemp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);
        const fromTemp = Math.min(currentTemp, amt);
        const nextTemp = currentTemp - fromTemp;
        const remaining = Math.max(0, amt - fromTemp);
        if (polymorphCondition && remaining >= char.hpCurrent) {
          await revertPolymorph(remaining - char.hpCurrent);
        } else {
          const newHp = Math.max(0, char.hpCurrent - remaining);
          const nextOverrides = nextTemp === currentTemp
            ? null
            : { ...overrides, tempHp: nextTemp };
          await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
          if (nextOverrides) {
            await api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides));
          }
          setChar((prev) => prev ? {
            ...prev,
            hpCurrent: newHp,
            overrides: nextOverrides ? { ...(prev.overrides ?? {}), ...nextOverrides } : prev.overrides,
            characterData: nextOverrides ? {
              ...(prev.characterData ?? {}),
              sheetOverrides: nextOverrides,
            } : prev.characterData,
          } : prev);
        }
      }
      setHpAmount("");
      setLastRoll(null);
      if (kind === "damage" && amt > 0 && (char.conditions ?? []).some((condition) => condition.key === "concentration")) {
        setConcentrationAlert({ dc: Math.max(10, Math.floor(amt / 2)) });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setHpError(`Failed: ${message}`);
      console.error("HP update failed:", error);
    } finally {
      setHpSaving(false);
    }
  };

  const resolveKind = (explicit: "damage" | "heal"): "damage" | "heal" =>
    hpAmount.trim().startsWith("+") ? "heal" : explicit;

  const handleApplyHp = (explicit: "damage" | "heal") => {
    const kind = resolveKind(explicit);
    if (hasDiceTerm(hpAmount)) {
      const rolled = rollAndFlash();
      setTimeout(() => {
        void applyHp(kind, rolled);
      }, 0);
    } else {
      void applyHp(kind);
    }
  };

  return {
    applyHp,
    handleApplyHp,
  };
}
