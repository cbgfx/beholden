const CANONICAL_COMPENDIUM_ID = /^[a-z0-9_]+$/;

export function canonicalizeCompendiumId(id: string): string {
  return String(id ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/\+/g, "_plus_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildCanonicalIdMap(ids: string[]): Map<string, string> {
  const mapping = new Map<string, string>();
  const claimed = new Map<string, string>();

  for (const oldId of ids) {
    const newId = canonicalizeCompendiumId(oldId);
    if (!newId || !CANONICAL_COMPENDIUM_ID.test(newId)) {
      throw new Error(`Could not produce a canonical ID for ${JSON.stringify(oldId)}.`);
    }
    const previous = claimed.get(newId);
    if (previous && previous !== oldId) {
      throw new Error(`Canonical ID collision: ${JSON.stringify(previous)} and ${JSON.stringify(oldId)} both map to ${JSON.stringify(newId)}.`);
    }
    claimed.set(newId, oldId);
    if (oldId !== newId) mapping.set(oldId, newId);
  }

  return mapping;
}
