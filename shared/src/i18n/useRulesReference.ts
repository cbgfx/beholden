import { useMemo } from "react";
import * as rules from "../domain/compendium/rulesReference";
import { useUiTranslation } from "./useUiTranslation";

/** Localize read-only reference tables without changing canonical domain data. */
export function useRulesReference() {
  const translate = useUiTranslation("sharedUi");
  return useMemo(() => {
    function rows<T extends Record<string, string | string[]>>(source: T[]): T[] {
      return source.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
        key, Array.isArray(value) ? value.map((text) => translate(text)) : translate(value),
      ])) as T);
    }
    return {
      CONDITIONS: rows(rules.CONDITIONS),
      SIGHT_TYPES: rows(rules.SIGHT_TYPES),
      SCHOOLS_OF_MAGIC: rows(rules.SCHOOLS_OF_MAGIC),
      EXHAUSTION_2024: rows(rules.EXHAUSTION_2024),
      TRAVEL_PACE: rows(rules.TRAVEL_PACE),
      LIFESTYLE: rows(rules.LIFESTYLE),
      FOOD_LODGING: rows(rules.FOOD_LODGING),
    };
  }, [translate]);
}
