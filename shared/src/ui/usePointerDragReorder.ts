import React from "react";

type ReorderOptions<T extends { id: string }> = {
  items: T[];
  onReorder: (ids: string[]) => void;
};

export function usePointerDragReorder<T extends { id: string }>(
  options: ReorderOptions<T>,
) {
  const { items, onReorder } = options;
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [orderIds, setOrderIds] = React.useState<string[] | null>(null);

  const orderIdsRef = React.useRef<string[] | null>(null);
  React.useEffect(() => {
    orderIdsRef.current = orderIds;
  }, [orderIds]);

  const dragStateRef = React.useRef<{
    startY: number;
    lastOverId: string | null;
    changed: boolean;
  } | null>(null);

  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const displayItems = React.useMemo(() => {
    if (!orderIds) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    return orderIds.map((id) => byId.get(id)).filter((item): item is T => Boolean(item));
  }, [items, orderIds]);

  React.useEffect(() => {
    if (!dragId) setOrderIds(null);
  }, [items, dragId]);

  const reorderInState = React.useCallback((fromId: string, toId: string) => {
    setOrderIds((prev) => {
      const ids = prev ? [...prev] : items.map((item) => item.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0 || from === to) return ids;
      ids.splice(from, 1);
      ids.splice(to, 0, fromId);
      return ids;
    });
  }, [items]);

  const findOverId = React.useCallback((clientY: number, draggingId: string): string | null => {
    const ids = (orderIdsRef.current ?? orderIds ?? items.map((item) => item.id))
      .filter((id) => id !== draggingId);
    if (ids.length === 0) return null;

    const first = ids[0];
    const firstRect = rowRefs.current[first]?.getBoundingClientRect();
    if (firstRect && clientY <= firstRect.top) return first;

    const last = ids[ids.length - 1];
    const lastRect = rowRefs.current[last]?.getBoundingClientRect();
    if (lastRect && clientY >= lastRect.bottom) return last;

    for (const id of ids) {
      const element = rowRefs.current[id];
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return id;
    }
    return null;
  }, [items, orderIds]);

  const onHandlePointerDown = React.useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setDragId(id);
    const ids = items.map((item) => item.id);
    setOrderIds(ids);
    orderIdsRef.current = ids;
    dragStateRef.current = { startY: e.clientY, lastOverId: null, changed: false };
  }, [items]);

  const onHandlePointerMove = React.useCallback((e: React.PointerEvent) => {
    if (!dragId || !dragStateRef.current) return;
    const state = dragStateRef.current;
    if (Math.abs(e.clientY - state.startY) < 6) return;
    const overId = findOverId(e.clientY, dragId);
    if (!overId || overId === dragId || state.lastOverId === overId) return;
    state.lastOverId = overId;
    state.changed = true;
    reorderInState(dragId, overId);
  }, [dragId, findOverId, reorderInState]);

  const endDrag = React.useCallback((commit: boolean) => {
    const state = dragStateRef.current;
    dragStateRef.current = null;
    const ids = orderIdsRef.current ?? orderIds ?? items.map((item) => item.id);
    const shouldCommit = commit && Boolean(state?.changed);

    setDragId(null);
    setOrderIds(null);
    orderIdsRef.current = null;

    if (shouldCommit) onReorder(ids);
  }, [items, onReorder, orderIds]);

  return {
    dragId,
    displayItems,
    rowRefs,
    onHandlePointerDown,
    onHandlePointerMove,
    endDrag,
  };
}
