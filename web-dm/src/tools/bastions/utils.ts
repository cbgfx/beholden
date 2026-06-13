export function specialSlotsForLevel(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 2;
  return 0;
}

export function normalizeOrder(value: string | null | undefined): string | null {
  const next = String(value ?? "").trim();
  return next.length > 0 ? next : null;
}

export function orderListWithMaintain(orders: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const order of [...orders, "Maintain"]) {
    const key = order.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(order);
  }
  return out;
}
