/** Persisted column metadata is shared by workspace and character-sheet layouts. */
export const COLUMN_ICON_PRESETS = [
  "stats",
  "actions",
  "spells",
  "inventory",
  "notes",
  "rest",
  "players",
  "encounter",
  "target",
  "adventure",
] as const;

export type ColumnIconId =
  | (typeof COLUMN_ICON_PRESETS)[number]
  | `game-icons:${string}`;
export interface ColumnHeader {
  name?: string;
  icon?: ColumnIconId;
}

export const COLUMN_NAME_MAX_LENGTH = 60;
export const COLUMN_ICON_PATTERN = new RegExp(
  `^(${COLUMN_ICON_PRESETS.join("|")}|game-icons:[a-z0-9]+(?:-[a-z0-9]+)*)$`,
);

export function isColumnIcon(value: unknown): value is ColumnIconId {
  return typeof value === "string" && COLUMN_ICON_PATTERN.test(value);
}

/** Keep client recovery tolerant; the server uses the same rules to reject invalid writes. */
export function normalizeColumnHeaders(
  value: unknown,
  count: number,
): ColumnHeader[] {
  return Array.from({ length: count }, (_, index) => {
    const raw: unknown = Array.isArray(value) ? value[index] : undefined;
    if (!raw || typeof raw !== "object") return {};
    const header = raw as Record<string, unknown>;
    const name =
      typeof header.name === "string"
        ? header.name.trim().slice(0, COLUMN_NAME_MAX_LENGTH)
        : "";
    return {
      ...(name ? { name } : {}),
      ...(isColumnIcon(header.icon) ? { icon: header.icon } : {}),
    };
  });
}
