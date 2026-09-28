import { resolveActorDamage } from "@beholden/shared/domain";
import type { EncounterActor } from "@/domain/types/domain";

/**
 * Client-side preview only — used for instant optimistic UI feedback while the request is in
 * flight. The server independently recomputes this from fresh data and its response (or the
 * `encounter:combatantsDelta` broadcast) is what actually gets persisted/displayed; see the
 * `hpDelta` field on the combatant PUT for why the server doesn't just trust this value.
 */
export function resolveCombatantDamage(combatant: EncounterActor, amount: number): {
  hpCurrent: number;
  overrides: EncounterActor["overrides"];
  conditions?: EncounterActor["conditions"];
} | null {
  return resolveActorDamage(combatant, amount);
}
