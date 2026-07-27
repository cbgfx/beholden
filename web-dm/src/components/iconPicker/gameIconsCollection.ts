// web-dm/src/components/iconPicker/gameIconsCollection.ts
//
// Loads the full offline Game Icons collection exactly once (dynamically, so
// it code-splits away from the main bundle) and registers it with Iconify so
// <Icon icon="game-icons:..."/> renders without any network request. Every
// other module in this feature — and the rest of the app — should go through
// this file rather than importing @iconify-json/game-icons directly.

import { useEffect, useState } from "react";
import { addCollection } from "@iconify/react";

export const GAME_ICONS_PREFIX = "game-icons";

let namesCache: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

function loadGameIconNames(): Promise<string[]> {
  if (namesCache) return Promise.resolve(namesCache);
  if (!loadPromise) {
    loadPromise = import("@iconify-json/game-icons").then((mod) => {
      addCollection(mod.icons);
      const names = Object.keys(mod.icons.icons).sort();
      namesCache = names;
      return names;
    });
  }
  return loadPromise;
}

/** Full sorted list of Game Icons names (without the `game-icons:` prefix); null while loading. */
export function useGameIconNames(): string[] | null {
  const [names, setNames] = useState<string[] | null>(namesCache);
  useEffect(() => {
    if (namesCache) return;
    let cancelled = false;
    void loadGameIconNames().then((list) => {
      if (!cancelled) setNames(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return names;
}

/** True once the collection is registered with Iconify and icons are safe to render offline. */
export function useGameIconsReady(): boolean {
  const [ready, setReady] = useState(namesCache !== null);
  useEffect(() => {
    if (namesCache) return;
    let cancelled = false;
    void loadGameIconNames().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

export function toGameIconId(name: string): string {
  return `${GAME_ICONS_PREFIX}:${name}`;
}

export function trimGameIconPrefix(iconId: string): string {
  return iconId.startsWith(`${GAME_ICONS_PREFIX}:`) ? iconId.slice(GAME_ICONS_PREFIX.length + 1) : iconId;
}

/** Case-insensitive search key: strips the collection prefix and treats -/_ as spaces. */
export function normalizeIconSearchText(raw: string): string {
  return trimGameIconPrefix(raw).toLowerCase().replace(/[-_]+/g, " ").trim();
}
