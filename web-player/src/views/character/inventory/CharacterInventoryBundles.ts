export type ParsedPack = {
  containerName: string;
  items: Array<{ name: string; quantity: number }>;
};

function singularizePackItem(name: string): string {
  const trimmed = name.trim();
  if (/\bcases$/iu.test(trimmed)) return trimmed.replace(/cases$/iu, "Case");
  if (/\bcostumes$/iu.test(trimmed)) return trimmed.replace(/costumes$/iu, "Costume");
  if (/\bcandles$/iu.test(trimmed)) return trimmed.replace(/candles$/iu, "Candle");
  if (/\btorches$/iu.test(trimmed)) return trimmed.replace(/torches$/iu, "Torch");
  if (/\bpens$/iu.test(trimmed)) return trimmed.replace(/pens$/iu, "Pen");
  return trimmed;
}

/** Legacy safety net for pack entries whose typed `bundle` fact is absent. Typed bundle data
 * remains authoritative; this parser only recognizes the narrow PHB "contains" sentence. */
export function parsePackDescription(itemName: string, description: string | null | undefined): ParsedPack | null {
  if (!/\bpack\b/iu.test(itemName) || !description?.trim()) return null;
  const match = description.match(/\bcontains the following items:\s*(.+?)(?:\.\s*(?:Source:|$)|$)/isu);
  if (!match?.[1]) return null;
  const parts = match[1]
    .replace(/,?\s+and\s+/iu, ", ")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;

  const parsed = parts.map((part) => {
    const quantityMatch = part.match(/^(\d+)\s+(?:(?:flasks?|days?|sheets?)\s+of\s+)?(.+)$/iu);
    return {
      name: singularizePackItem(quantityMatch?.[2] ?? part),
      quantity: quantityMatch?.[1] ? Number(quantityMatch[1]) : 1,
    };
  });
  const container = parsed.shift();
  if (!container || !/^(?:backpack|chest)$/iu.test(container.name)) return null;
  return { containerName: container.name, items: parsed };
}

export function normalizePackLookupName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}
