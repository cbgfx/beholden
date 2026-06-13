export function getSecondsInRound(args: { started: boolean; round: number | string }): number | null {
  const { started, round } = args;
  // Display round time as (Round * 6 - 6): Round 1 => 0s, Round 2 => 6s, etc.
  // Intentionally NOT tied to Prev/Next navigation (active combatant).
  if (!started) return null;
  const r = Number(round);
  if (!Number.isFinite(r) || r < 1) return 0;
  return (r - 1) * 6;
}
