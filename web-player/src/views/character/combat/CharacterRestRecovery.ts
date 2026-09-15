import { overridesAfterLongRest } from "@beholden/shared/domain/actors";
import type { SheetOverrides } from "../CharacterViewTypes";

export function getLongRestRecovery(hitDiceMax: number, exhaustion: number): {
  hitDiceCurrent: number;
  exhaustion: number;
} {
  return {
    hitDiceCurrent: Math.max(0, Math.floor(hitDiceMax)),
    exhaustion: Math.max(0, Math.floor(exhaustion) - 1),
  };
}

export function getLongRestOverrides(
  inspiration: boolean,
  grantsInspiration: boolean,
  current: SheetOverrides = { tempHp: 0, acBonus: 0, hpMaxBonus: 0 },
): SheetOverrides {
  // Which bonuses survive the night is shared with the DM's party-wide rest; the inspiration grant
  // is player-only, since it comes from a race feature the server doesn't resolve.
  return {
    ...overridesAfterLongRest(current),
    inspiration: inspiration || grantsInspiration,
  } as SheetOverrides;
}
