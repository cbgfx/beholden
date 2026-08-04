// web-dm/src/views/BinderView/useMortalSavedViews.ts
// Named Mortal-list filter presets (query + filters), persisted to localStorage per Binder.
import { useEffect, useState } from "react";

export type MortalFilters = {
  position: string[];
  organization: string[];
  continent: string[];
  location: string[];
  species: string[];
  status: string[];
  gender: string[];
  linked: string[];
};

export type SavedMortalView = {
  id: string;
  name: string;
  query: string;
  filters: MortalFilters;
};

export const emptyMortalFilters = (): MortalFilters => ({
  position: [],
  organization: [],
  continent: [],
  location: [],
  species: [],
  status: [],
  gender: [],
  linked: [],
});

export function useMortalSavedViews(binderId: string) {
  const [savedViews, setSavedViews] = useState<SavedMortalView[]>([]);
  const [selectedViewId, setSelectedViewId] = useState("");
  const [viewName, setViewName] = useState("");
  const storageKey = `binder:${binderId}:mortal-views`;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as SavedMortalView[];
      setSavedViews(Array.isArray(stored) ? stored.map((view) => ({
        ...view,
        filters: Object.fromEntries(Object.entries(emptyMortalFilters()).map(([key]) => {
          const value = (view.filters as unknown as Record<string, string | string[] | undefined>)[key];
          return [key, Array.isArray(value) ? value : value ? [value] : []];
        })) as MortalFilters,
      })) : []);
    } catch {
      setSavedViews([]);
    }
    setSelectedViewId("");
  }, [storageKey]);

  function persist(next: SavedMortalView[]) {
    setSavedViews(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function save(query: string, filters: MortalFilters) {
    const name = viewName.trim();
    if (!name) return;
    const existing = savedViews.find((view) => view.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    const view: SavedMortalView = { id: existing?.id ?? crypto.randomUUID(), name, query, filters };
    const next = existing
      ? savedViews.map((item) => item.id === existing.id ? view : item)
      : [...savedViews, view];
    persist(next);
    setSelectedViewId(view.id);
    setViewName("");
  }

  function apply(viewId: string): SavedMortalView | undefined {
    setSelectedViewId(viewId);
    return savedViews.find((item) => item.id === viewId);
  }

  function removeSelected() {
    persist(savedViews.filter((view) => view.id !== selectedViewId));
    setSelectedViewId("");
  }

  function clearSelection() {
    setSelectedViewId("");
  }

  return { savedViews, selectedViewId, viewName, setViewName, save, apply, removeSelected, clearSelection };
}
