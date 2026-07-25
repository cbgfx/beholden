import type { MonsterDetail } from "@/views/CombatView/types";

export function dexModFromMonster(d: MonsterDetail | null): number {
  const raw = d?.raw_json as Record<string, unknown> | undefined;
  const dex = Number(d?.dex ?? raw?.["dex"] ?? null);
  if (!Number.isFinite(dex)) return 0;
  return Math.floor((dex - 10) / 2);
}

