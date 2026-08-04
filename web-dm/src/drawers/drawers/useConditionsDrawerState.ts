// web-dm/src/drawers/drawers/useConditionsDrawerState.ts
// Condition business rules (caster association, hex-ability claiming, expiry cycling) and the
// debounced-commit state machine behind CombatantConditionsDrawer. No rendering here.
import React from "react";
import type { EncounterActorDto } from "@beholden/shared/api";
import type { SharedAbilityKey, SharedConditionInstance } from "@beholden/shared/domain";
import { putEncounterCombatant } from "@/services/encounterApi";
import { useStore, type DrawerState } from "@/store";
import { CONDITION_DEFS } from "@/domain/conditions";

export type ConditionsDrawerState = Exclude<Extract<DrawerState, { type: "combatantConditions" }>, null>;

export type ConditionInstance = SharedConditionInstance & { expiresAtRound?: number | null };

// Only these conditions require a caster association.
export const NEEDS_CASTER_KEYS = new Set(["hexed", "marked"]);
export const REPEATABLE_CASTER_KEYS = new Set(["hexed", "marked"]);
export const HEX_ABILITIES: Array<{ key: SharedAbilityKey; label: string }> = [
  { key: "str", label: "Strength (Str)" },
  { key: "dex", label: "Dexterity (Dex)" },
  { key: "con", label: "Constitution (Con)" },
  { key: "int", label: "Intelligence (Int)" },
  { key: "wis", label: "Wisdom (Wis)" },
  { key: "cha", label: "Charisma (Cha)" },
];
export function needsCasterForKey(key: string) {
  return NEEDS_CASTER_KEYS.has(String(key ?? "").trim().toLowerCase());
}
export function isRepeatableCasterKey(key: string) {
  return REPEATABLE_CASTER_KEYS.has(String(key ?? "").trim().toLowerCase());
}

/** Cycle the expiry round: null → cr+1 → cr+2 → cr+3 → cr+4 → null */
export function cycleExpiry(current: number | null | undefined, cr: number): number | null {
  if (current == null) return cr + 1;
  const remaining = current - cr;
  if (remaining <= 0) return cr + 1;   // was expired — reset to +1
  if (remaining >= 4) return null;      // at max — clear
  return cr + remaining + 1;
}

export function useConditionsDrawerState(
  drawer: ConditionsDrawerState,
  refreshEncounter: (eid: string | null) => Promise<void>,
) {
  const { state } = useStore();
  const [conds, setConds] = React.useState<ConditionInstance[]>([]);
  const debounceRef = React.useRef<number | null>(null);
  const skipNextCommitRef = React.useRef<boolean>(true);
  // Refs to latest values — used in the unmount flush below (initialized after commit is declared).
  const condsRef = React.useRef<ConditionInstance[]>(conds);
  const commitRef = React.useRef<(c: ConditionInstance[]) => Promise<void>>(async () => { /* populated below */ });

  const currentRound = drawer.currentRound ?? 0;

  const combatant = React.useMemo(
    () => state.combatants.find((x) => x.id === drawer.combatantId),
    [drawer.combatantId, state.combatants]
  );

  React.useEffect(() => {
    if (!combatant) { setConds([]); return; }
    const raw = Array.isArray(combatant.conditions) ? combatant.conditions : [];
    const claimedHexAbilities = new Set<SharedAbilityKey>();
    skipNextCommitRef.current = true;
    setConds(raw.map((x) => {
      const key = String(x.key ?? "");
      const requestedHexAbility = x.hexAbility;
      const validHexAbility = HEX_ABILITIES.some((ability) => ability.key === requestedHexAbility)
        ? requestedHexAbility as SharedAbilityKey
        : undefined;
      const hexAbility = key === "hexed"
        && validHexAbility
        && !claimedHexAbilities.has(validHexAbility)
        ? validHexAbility
        : undefined;
      if (hexAbility) claimedHexAbilities.add(hexAbility);

      return {
        ...x,
        key,
        casterId: x.casterId ?? null,
        expiresAtRound: x.expiresAtRound != null ? Number(x.expiresAtRound) : null,
        hexAbility,
      };
    }));
  }, [combatant]);

  const commit = React.useCallback(
    async (nextConds: ConditionInstance[]) => {
      const d = drawer;
      const next = nextConds.map((c) => ({
        ...c,
        key: c.key,
        casterId: c.casterId ?? null,
        expiresAtRound: c.expiresAtRound ?? null,
      }));
      try {
        const casterIds = [...new Set(
          next
            .filter((condition) => needsCasterForKey(condition.key) && condition.casterId)
            .map((condition) => condition.casterId as string),
        )];
        for (const casterId of casterIds) {
          const caster = state.combatants.find((combatant) => combatant.id === casterId);
          if (!caster || caster.conditions?.some((condition) => condition.key === "concentration")) continue;
          const casterConditions = [...(caster.conditions ?? []), { key: "concentration" }];
          const updatedCaster = await putEncounterCombatant<EncounterActorDto>(
            d.encounterId,
            casterId,
            { conditions: casterConditions },
          );
          const concentrationId = updatedCaster.live.conditions
            .find((condition) => condition.key === "concentration")?.concentrationId ?? null;
          for (const condition of next) {
            if (condition.casterId === casterId && needsCasterForKey(condition.key)) {
              condition.concentrationId = concentrationId;
            }
          }
        }
        await putEncounterCombatant(d.encounterId, d.combatantId, { conditions: next });
        await refreshEncounter(d.encounterId);
      } catch { /* Non-blocking */ }
    },
    [drawer, refreshEncounter, state.combatants]
  );

  // Keep latest-value refs in sync (needed for the unmount flush).
  React.useEffect(() => { condsRef.current = conds; });
  React.useEffect(() => { commitRef.current = commit; }, [commit]);

  // Debounced auto-save on any condition change.
  React.useEffect(() => {
    if (skipNextCommitRef.current) { skipNextCommitRef.current = false; return; }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void commitRef.current(condsRef.current);
    }, 250);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [conds]);

  // Flush any pending debounced save when the drawer unmounts (e.g. user presses "End" mid-edit).
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
        void commitRef.current(condsRef.current);
      }
    };
  }, []); // intentionally empty — runs only on unmount

  const allowedKeys = React.useMemo(() => {
    if (drawer.role === "active") return new Set<string>(["concentration", "invisible"]);
    const s = new Set(CONDITION_DEFS.map((c) => c.key));
    s.delete("concentration");
    return s;
  }, [drawer.role]);

  const toggle = React.useCallback((key: string) => {
    setConds((prev) => {
      const idx = prev.findIndex((c) => c.key === key);
      if (idx >= 0) { const next = [...prev]; next.splice(idx, 1); return next; }
      return [...prev, { key }];
    });
  }, []);

  // If the chosen caster currently has an active "concentration" condition, tie this dependent
  // condition to that specific session (rather than just the caster) so ending a LATER, unrelated
  // concentration of theirs doesn't also sweep this one away. Best-effort: if the caster isn't
  // concentrating (or has no id yet), the condition falls back to caster-only ownership.
  const concentrationIdFor = React.useCallback((casterId: string | null): string | null => {
    if (!casterId) return null;
    const caster = state.combatants.find((x) => x.id === casterId);
    const concentration = caster?.conditions?.find((c) => c.key === "concentration");
    return (concentration?.concentrationId as string | undefined) ?? null;
  }, [state.combatants]);

  const addCasterCondition = React.useCallback((key: string) => {
    const defaultCaster = drawer.activeIdForCaster ?? null;
    setConds((prev) => [...prev, { key, casterId: defaultCaster, concentrationId: concentrationIdFor(defaultCaster) }]);
  }, [drawer.activeIdForCaster, concentrationIdFor]);

  const setCasterForIndex = React.useCallback((idx: number, casterId: string | null) => {
    setConds((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], casterId, concentrationId: concentrationIdFor(casterId) };
      return next;
    });
  }, [concentrationIdFor]);

  const setHexAbilityForIndex = React.useCallback((idx: number, hexAbility: SharedAbilityKey | null) => {
    setConds((prev) => {
      const next = [...prev];
      const condition = { ...next[idx] };
      if (hexAbility) condition.hexAbility = hexAbility;
      else delete condition.hexAbility;
      next[idx] = condition;
      return next;
    });
  }, []);

  const setExpiryForIndex = React.useCallback((idx: number, expiresAtRound: number | null) => {
    setConds((prev) => { const next = [...prev]; next[idx] = { ...next[idx], expiresAtRound }; return next; });
  }, []);

  const removeAt = React.useCallback((idx: number) => {
    setConds((prev) => { const next = [...prev]; next.splice(idx, 1); return next; });
  }, []);

  const selectedKeys = new Set(conds.map((c) => c.key));
  const hexCount = conds.filter((c) => c.key === "hexed").length;
  const specialConditionKeys = new Set(["concentration", "hexed", "marked"]);
  const visibleDefs = CONDITION_DEFS
    .filter((c) => allowedKeys.has(c.key))
    .sort((a, b) => a.name.localeCompare(b.name));
  const conditionGroups = [
    visibleDefs.filter((condition) => !specialConditionKeys.has(condition.key)),
    visibleDefs.filter((condition) => specialConditionKeys.has(condition.key)),
  ].filter((group) => group.length > 0);

  return {
    combatants: state.combatants,
    conds,
    currentRound,
    selectedKeys,
    hexCount,
    conditionGroups,
    toggle,
    addCasterCondition,
    setCasterForIndex,
    setHexAbilityForIndex,
    setExpiryForIndex,
    removeAt,
  };
}
