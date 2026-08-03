import { useEffect, useState } from "react";

export const GAME_ICONS_PREFIX = "game-icons";
const COLLECTION_URL = `https://api.iconify.design/collection?prefix=${GAME_ICONS_PREFIX}&info=false`;

type IconifyCollectionResponse = {
  uncategorized?: string[];
  categories?: Record<string, string[]>;
};

let namesCache: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

function loadGameIconNames(): Promise<string[]> {
  if (namesCache) return Promise.resolve(namesCache);
  loadPromise ??= fetch(COLLECTION_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`Icon catalog request failed (${response.status}).`);
      return response.json() as Promise<IconifyCollectionResponse>;
    })
    .then((collection) => {
      const names = new Set(collection.uncategorized ?? []);
      Object.values(collection.categories ?? {}).forEach((category) => category.forEach((name) => names.add(name)));
      namesCache = Array.from(names).sort();
      return namesCache;
    })
    .catch((error: unknown) => {
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}

/** Icon names are fetched only when the picker opens; icon SVGs load on demand through Iconify. */
export function useGameIconNames(): string[] | null {
  const [names, setNames] = useState<string[] | null>(namesCache);
  useEffect(() => {
    if (namesCache) return;
    let cancelled = false;
    void loadGameIconNames().then((list) => { if (!cancelled) setNames(list); }).catch(() => {
      if (!cancelled) setNames([]);
    });
    return () => { cancelled = true; };
  }, []);
  return names;
}

export function toGameIconId(name: string): string { return `${GAME_ICONS_PREFIX}:${name}`; }
export function trimGameIconPrefix(iconId: string): string { return iconId.startsWith(`${GAME_ICONS_PREFIX}:`) ? iconId.slice(GAME_ICONS_PREFIX.length + 1) : iconId; }
export function normalizeIconSearchText(raw: string): string { return trimGameIconPrefix(raw).toLowerCase().replace(/[-_]+/g, " ").trim(); }
