export function getLongRestRecovery(hitDiceMax: number, exhaustion: number): {
  hitDiceCurrent: number;
  exhaustion: number;
} {
  return {
    hitDiceCurrent: Math.max(0, Math.floor(hitDiceMax)),
    exhaustion: Math.max(0, Math.floor(exhaustion) - 1),
  };
}
