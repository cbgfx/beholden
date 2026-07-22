const MAX_EXHAUSTION = 6;

export function getExhaustionD20Penalty(level: number): number {
  return clampExhaustion(level) * 2;
}

export function getExhaustedSpeed(baseSpeed: number, level: number): number {
  return Math.max(0, baseSpeed - clampExhaustion(level) * 5);
}

export function getExhaustionEffects(level: number): string[] {
  const normalized = clampExhaustion(level);
  if (normalized === 0) return [];
  return [
    `D20 Tests −${getExhaustionD20Penalty(normalized)}`,
    `Speed −${normalized * 5} ft.`,
    ...(normalized >= MAX_EXHAUSTION ? ["Death"] : []),
  ];
}

function clampExhaustion(level: number): number {
  return Math.max(0, Math.min(MAX_EXHAUSTION, Math.floor(level)));
}
