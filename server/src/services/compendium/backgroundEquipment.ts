export type BackgroundEquipmentEntry =
  | { kind: "item"; name: string; quantity: number }
  | { kind: "currency"; denomination: "PP" | "GP" | "EP" | "SP" | "CP"; amount: number };

export interface BackgroundEquipmentOption {
  id: string;
  entries: BackgroundEquipmentEntry[];
}

function splitEntries(value: string): string[] {
  return value
    .replace(/\s+or\s+$/iu, "")
    .replace(/,\s+and\s+/giu, ", ")
    .split(/\s*,\s*/u)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEntry(value: string): BackgroundEquipmentEntry | null {
  const currency = value.match(/^(\d+)\s*(PP|GP|EP|SP|CP)$/iu);
  if (currency?.[1] && currency[2]) {
    return {
      kind: "currency",
      denomination: currency[2].toUpperCase() as "PP" | "GP" | "EP" | "SP" | "CP",
      amount: Number(currency[1]),
    };
  }

  const leadingQuantity = value.match(/^(\d+)\s*[xÃ—]?\s+(.+)$/iu);
  if (leadingQuantity?.[1] && leadingQuantity[2]) {
    return {
      kind: "item",
      name: leadingQuantity[2].trim(),
      quantity: Number(leadingQuantity[1]),
    };
  }

  const containerQuantity = value.match(/^(.+?)\s+\((\d+)\s+(?:flask\s*s|flasks|sheets)\)$/iu);
  if (containerQuantity?.[1] && containerQuantity[2]) {
    return {
      kind: "item",
      name: containerQuantity[1].trim(),
      quantity: Number(containerQuantity[2]),
    };
  }

  return value.trim()
    ? { kind: "item", name: value.trim(), quantity: 1 }
    : null;
}

export function parseBackgroundEquipmentOptions(
  description: string,
): BackgroundEquipmentOption[] {
  const normalized = description
    .replace(/\r/gu, "")
    .replace(/Choose\s+A\s+or\s+8/giu, "Choose A or B")
    .replace(/\(8\)/gu, "(B)")
    .replace(/\u2022/gu, ";")
    .replace(/â€¢/gu, ";")
    .replace(/:\s+or\s+\(/giu, "; or (")
    .replace(/\s+/gu, " ")
    .trim();
  const matches = [
    ...normalized.matchAll(
      /\(([A-Z])\)\s*([\s\S]*?)(?=(?:;\s*or\s*\([A-Z]\))|(?:;\s*\([A-Z]\))|$)/gu,
    ),
  ];
  return matches.flatMap((match) => {
    const id = match[1] ?? "";
    const entries = splitEntries((match[2] ?? "").trim().replace(/;$/u, ""))
      .map(parseEntry)
      .filter((entry): entry is BackgroundEquipmentEntry => entry != null);
    return id && entries.length > 0 ? [{ id, entries }] : [];
  });
}
