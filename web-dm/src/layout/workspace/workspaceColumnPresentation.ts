import type { ColumnIconId } from "@beholden/shared/domain/layoutColumns";

/** Defaults belong to the DM's panels; shared navigation only renders the result. */
export function workspaceColumnIcon(
  panelId?: string,
): ColumnIconId | undefined {
  if (!panelId) return undefined;
  if (panelId === "target") return "target";
  if (panelId === "active" || /player|npc/.test(panelId)) return "players";
  if (/encounter|turn-controls|initiative/.test(panelId)) return "encounter";
  if (/treasure|inventory/.test(panelId)) return "inventory";
  if (/adventure/.test(panelId)) return "adventure";
  return "notes";
}
