// web-dm/src/components/iconPicker/entityIconDefaults.ts
//
// Single source of truth for the fallback icon shown when a record has no
// icon of its own. Add a new entry here when a new Binder entity gains icon
// support — never hardcode a fallback icon anywhere else.

import type { BinderReferenceType } from "@/services/binderReferenceApi";
import { toGameIconId } from "./gameIconsCollection";

const DEFAULT_ENTITY_ICON_NAMES: Partial<Record<BinderReferenceType, string>> = {
  organizations: "castle",
  positions: "rank-3",
  "points-of-interest": "village",
};

/** The reference types that currently support a custom icon. */
export const ICON_ENABLED_REFERENCE_TYPES: ReadonlySet<BinderReferenceType> = new Set(
  Object.keys(DEFAULT_ENTITY_ICON_NAMES) as BinderReferenceType[],
);

export function getDefaultEntityIcon(type: BinderReferenceType): string | null {
  const name = DEFAULT_ENTITY_ICON_NAMES[type];
  return name ? toGameIconId(name) : null;
}
