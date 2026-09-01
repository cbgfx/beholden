import React from "react";
import type { PanelId } from "@/views/character/panelRegistry";

/** The palette sidebar's zone id -- panels not currently placed in any column
 * of the active view live here. Column zones are keyed by their index
 * (`"0"`, `"1"`, ...) in left-to-right order. */
export const SIDEBAR_ZONE_ID = "__sidebar__";

type ZoneId = string;
type ZonesById = Record<ZoneId, PanelId[]>;

/**
 * Cross-zone pointer-drag reordering, modeled on
 * `beholden/shared/src/ui/usePointerDragReorder.ts` but generalized from "one
 * flat list of typed items" to "N zones of panel ids" (each sheet-view column
 * plus the palette sidebar), and using window-level pointer listeners rather
 * than per-element `setPointerCapture`.
 *
 * That difference matters here specifically: the existing hook only ever
 * reorders *within* one list, so its dragged element never leaves its parent
 * and capture is never at risk. Here a drag routinely moves a panel to a
 * *different* column -- a different React parent -- which makes React
 * unmount the old DOM node and mount a new one rather than reuse it.
 * Capture tied to the unmounted node is lost with it, silently stranding the
 * drag (the stuck-at-half-opacity, "it just disappeared" bug). Listening on
 * `window` instead is immune to any of that churn.
 */
export function usePanelDragAndDrop(options: {
  /** Zones in left-to-right visual order (columns first, sidebar last). */
  zones: { id: ZoneId; ids: PanelId[] }[];
  onCommit: (zones: ZonesById) => void;
}) {
  const { zones, onCommit } = options;
  const onCommitRef = React.useRef(onCommit);
  React.useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  const baseZones = React.useMemo<ZonesById>(
    () => Object.fromEntries(zones.map((zone) => [zone.id, zone.ids])),
    [zones],
  );

  const [dragId, setDragId] = React.useState<PanelId | null>(null);
  const [workingZones, setWorkingZones] = React.useState<ZonesById | null>(null);
  const [pointerPos, setPointerPos] = React.useState<{ x: number; y: number } | null>(null);
  const workingZonesRef = React.useRef<ZonesById | null>(null);
  React.useEffect(() => { workingZonesRef.current = workingZones; }, [workingZones]);

  const dragStateRef = React.useRef<{ startX: number; startY: number; lastOverKey: string | null; changed: boolean } | null>(null);
  const zoneRefs = React.useRef<Record<ZoneId, HTMLDivElement | null>>({});
  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const rowKey = (zoneId: ZoneId, id: PanelId) => `${zoneId}:${id}`;

  const displayZones = workingZones ?? baseZones;

  // If the underlying data changes mid-drag (shouldn't normally happen, but
  // don't leave a stale working copy around if it does).
  React.useEffect(() => {
    if (!dragId) setWorkingZones(null);
  }, [zones, dragId]);

  const findTargetZone = React.useCallback((clientX: number): ZoneId | null => {
    let best: ZoneId | null = null;
    let bestDistance = Infinity;
    for (const zone of zones) {
      const el = zoneRefs.current[zone.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return zone.id;
      const distance = clientX < rect.left ? rect.left - clientX : clientX - rect.right;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = zone.id;
      }
    }
    return best;
  }, [zones]);

  // Midpoint-based, not "which row's full rect contains the cursor": with a
  // full-rect test, inserting before/after a row shifts that row's own
  // position, which can immediately put the (unmoved) cursor back "inside"
  // a *different* row than a moment ago -- move, reflow, move again,
  // feedback-looping into a visibly skittish back-and-forth on a single
  // adjacent swap. Comparing against each row's midpoint instead means the
  // cursor has to travel *past* the midpoint it just crossed to flip back,
  // which is the natural hysteresis that keeps a one-step move stable.
  const findInsertIndex = React.useCallback((zoneId: ZoneId, clientY: number, draggingId: PanelId): number => {
    const ids = (workingZonesRef.current ?? baseZones)[zoneId]?.filter((id) => id !== draggingId) ?? [];
    for (let index = 0; index < ids.length; index += 1) {
      const rect = rowRefs.current[rowKey(zoneId, ids[index])]?.getBoundingClientRect();
      if (!rect) continue;
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return ids.length;
  }, [baseZones]);

  const moveTo = React.useCallback((draggingId: PanelId, targetZone: ZoneId, insertIndex: number) => {
    setWorkingZones((prev) => {
      const source = prev ?? baseZones;
      const next: ZonesById = {};
      for (const zoneId of Object.keys(source)) next[zoneId] = source[zoneId].filter((id) => id !== draggingId);
      const targetList = next[targetZone] ?? (next[targetZone] = []);
      targetList.splice(Math.max(0, Math.min(insertIndex, targetList.length)), 0, draggingId);
      workingZonesRef.current = next;
      return next;
    });
  }, [baseZones]);

  const endDrag = React.useCallback((commit: boolean) => {
    const state = dragStateRef.current;
    dragStateRef.current = null;
    const finalZones = workingZonesRef.current ?? baseZones;
    const shouldCommit = commit && Boolean(state?.changed);
    setDragId(null);
    setWorkingZones(null);
    setPointerPos(null);
    workingZonesRef.current = null;
    if (shouldCommit) onCommitRef.current(finalZones);
  }, [baseZones]);

  const onHandlePointerDown = React.useCallback((e: React.PointerEvent, id: PanelId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragId(id);
    setWorkingZones(baseZones);
    setPointerPos({ x: e.clientX, y: e.clientY });
    workingZonesRef.current = baseZones;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, lastOverKey: null, changed: false };
  }, [baseZones]);

  // Window-level, not per-element: the dragged id can (and routinely does)
  // move to a DOM node in a different React parent mid-gesture, which would
  // sever any capture/listener tied to the original element.
  React.useEffect(() => {
    if (!dragId) return;

    const handleMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
      const state = dragStateRef.current;
      if (!state) return;
      if (Math.abs(e.clientX - state.startX) < 4 && Math.abs(e.clientY - state.startY) < 4) return;
      const targetZone = findTargetZone(e.clientX);
      if (!targetZone) return;
      const insertIndex = findInsertIndex(targetZone, e.clientY, dragId);
      const key = `${targetZone}:${insertIndex}`;
      if (state.lastOverKey === key) return;
      state.lastOverKey = key;
      state.changed = true;
      moveTo(dragId, targetZone, insertIndex);
    };
    const handleUp = () => endDrag(true);
    const handleCancel = () => endDrag(false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [dragId, findTargetZone, findInsertIndex, moveTo, endDrag]);

  const registerZone = React.useCallback((zoneId: ZoneId) => (el: HTMLDivElement | null) => {
    zoneRefs.current[zoneId] = el;
  }, []);
  const registerRow = React.useCallback((zoneId: ZoneId, panelId: PanelId) => (el: HTMLDivElement | null) => {
    rowRefs.current[rowKey(zoneId, panelId)] = el;
  }, []);

  return { dragId, displayZones, pointerPos, registerZone, registerRow, onHandlePointerDown };
}
