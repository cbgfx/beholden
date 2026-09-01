import React from "react";
import type { SheetViewDef } from "@/views/character/panelRegistry";
import { normalizeSheetViews, resolveActiveSheetView } from "@/views/character/sheetViewLayout";
import { useQueuedPersistedState } from "@/views/character/useQueuedPersistedState";

/** Local optimistic state plus serialized saves for whole-array sheet-view
 * updates. Serializing matters because each patch contains the complete
 * `sheetViews` array; overlapping requests could otherwise finish out of
 * order and resurrect an older layout. */
export function useCharacterSheetViews(options: {
  storedViews: SheetViewDef[] | null | undefined;
  activeViewId: string;
  onActiveViewChange: (id: string) => void;
  onSave: (views: SheetViewDef[]) => Promise<unknown>;
}) {
  const { activeViewId, onActiveViewChange } = options;
  const normalizedStoredViews = React.useMemo(
    () => normalizeSheetViews(options.storedViews),
    [options.storedViews],
  );
  const [views, updatePersistedViews] = useQueuedPersistedState(normalizedStoredViews, options.onSave);
  const updateViews = React.useCallback(
    (updater: (current: SheetViewDef[]) => SheetViewDef[]) => {
      updatePersistedViews((current) => normalizeSheetViews(updater(current)));
    },
    [updatePersistedViews],
  );

  const activeView = resolveActiveSheetView(views, activeViewId);
  React.useEffect(() => {
    if (activeView.id !== activeViewId) onActiveViewChange(activeView.id);
  }, [activeView.id, activeViewId, onActiveViewChange]);

  return { views, activeView, updateViews };
}
