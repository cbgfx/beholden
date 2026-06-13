import { api } from "@/services/api";
import type { Ruleset } from "@/lib/characterRules";

type CatalogFields =
  | "id"
  | "name"
  | "hd"
  | "size"
  | "speed"
  | "ruleset";

function withFields(path: string, fields: readonly CatalogFields[]): string {
  if (!fields.length) return path;
  const query = `fields=${encodeURIComponent(fields.join(","))}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

export type ClassCatalogRow = {
  id: string;
  name: string;
  hd?: number | null;
  ruleset?: Ruleset | null;
};

export type RaceCatalogRow = {
  id: string;
  name: string;
  size?: string | null;
  speed?: number | null;
  ruleset?: Ruleset | null;
};

export type BackgroundCatalogRow = {
  id: string;
  name: string;
  ruleset?: Ruleset | null;
};

export type FeatCatalogRow = {
  id: string;
  name: string;
  ruleset?: Ruleset | null;
};

export function fetchClassCatalog(fields: readonly CatalogFields[] = ["id", "name", "hd", "ruleset"]) {
  return api<ClassCatalogRow[]>(withFields("/api/compendium/classes", fields));
}

export function fetchRaceCatalog(fields: readonly CatalogFields[] = ["id", "name", "size", "speed", "ruleset"]) {
  return api<RaceCatalogRow[]>(withFields("/api/compendium/races", fields));
}

export function fetchBackgroundCatalog(fields: readonly CatalogFields[] = ["id", "name", "ruleset"]) {
  return api<BackgroundCatalogRow[]>(withFields("/api/compendium/backgrounds", fields));
}

export function fetchFeatCatalog(fields: readonly CatalogFields[] = ["id", "name", "ruleset"]) {
  return api<FeatCatalogRow[]>(withFields("/api/compendium/feats", fields));
}
