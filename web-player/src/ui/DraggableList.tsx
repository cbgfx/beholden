import React from "react";
import { C, withAlpha } from "@/lib/theme";

export type DragItem = { id: string };

/**
 * DraggableList: handle-only pointer drag reorder + selectable rows.
 * Works on iPad (iOS Safari) — no HTML5 drag-and-drop.
 * Drag only starts from the ≡ handle; normal taps/scrolls work normally.
 */
export function DraggableList(props: {
  items: DragItem[];
  expandedIds?: string[];
  onSelect?: (id: string) => void;
  onReorder: (ids: string[]) => void;
  renderItem: (item: DragItem) => React.ReactNode;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [orderIds, setOrderIds] = React.useState<string[] | null>(null);
  const orderIdsRef = React.useRef<string[] | null>(null);
  React.useEffect(() => { orderIdsRef.current = orderIds; }, [orderIds]);

  const dragStateRef = React.useRef<{
    startY: number;
    lastOverId: string | null;
    changed: boolean;
  } | null>(null);

  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const displayItems = React.useMemo(() => {
    if (!orderIds) return props.items;
    const byId: Record<string, DragItem> = {};
    for (const it of props.items) byId[it.id] = it;
    return orderIds.map((id) => byId[id]).filter(Boolean);
  }, [orderIds, props.items]);

  React.useEffect(() => {
    if (!dragId) setOrderIds(null);
  }, [props.items, dragId]);

  function reorderInState(fromId: string, toId: string) {
    setOrderIds((prev) => {
      const ids = prev ? [...prev] : props.items.map((i) => i.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0 || from === to) return ids;
      ids.splice(from, 1);
      ids.splice(to, 0, fromId);
      return ids;
    });
  }

  function findOverId(clientY: number, draggingId: string): string | null {
    const ids = (orderIdsRef.current ?? orderIds ?? props.items.map((i) => i.id)).filter((id) => id !== draggingId);
    let last: string | null = null;
    for (const id of ids) {
      const el = rowRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      last = id;
      if (clientY < r.top + r.height / 2) return id;
    }
    return last;
  }

  function onHandlePointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setDragId(id);
    const ids = props.items.map((i) => i.id);
    setOrderIds(ids);
    orderIdsRef.current = ids;
    dragStateRef.current = { startY: e.clientY, lastOverId: null, changed: false };
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragId || !dragStateRef.current) return;
    const st = dragStateRef.current;
    if (Math.abs(e.clientY - st.startY) < 6) return;
    const overId = findOverId(e.clientY, dragId);
    if (!overId || overId === dragId || st.lastOverId === overId) return;
    st.lastOverId = overId;
    st.changed = true;
    reorderInState(dragId, overId);
  }

  function endDrag(commit: boolean) {
    const st = dragStateRef.current;
    dragStateRef.current = null;
    const ids = orderIdsRef.current ?? orderIds ?? props.items.map((i) => i.id);
    const shouldCommit = commit && !!st?.changed;
    setDragId(null);
    setOrderIds(null);
    orderIdsRef.current = null;
    if (shouldCommit) props.onReorder(ids);
  }

  return (
    <div>
      {displayItems.map((it) => {
        const isExpanded = props.expandedIds?.includes(it.id) ?? false;
        const isDragging = dragId === it.id;
        const bg = isExpanded
          ? "rgba(0,0,0,0.1)"
          : isDragging
          ? "rgba(0,0,0,0.08)"
          : "rgba(0,0,0,0.0)";

        return (
          <div
            key={it.id}
            ref={(el) => { rowRefs.current[it.id] = el; }}
            onClick={() => props.onSelect?.(it.id)}
            style={{
              borderRadius: 8,
              marginBottom: 3,
              userSelect: "none",
              cursor: props.onSelect ? "pointer" : "default",
              background: bg,
              opacity: isDragging ? 0.85 : 1,
            }}
          >
            <div style={{ padding: 3, display: "flex", alignItems: "flex-start", gap: 5 }}>
              {/* Drag handle */}
              <div
                title="Drag to reorder"
                role="button"
                aria-label="Drag to reorder"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onPointerDown={(e) => onHandlePointerDown(e, it.id)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={() => endDrag(true)}
                onPointerCancel={() => endDrag(false)}
                style={{
                  width: 24, height: 24, marginTop: 2,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 6, border: `1px solid ${C.panelBorder}`,
                  background: "rgba(0,0,0,0.12)",
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  flex: "0 0 auto", color: C.muted,
                }}
              >
                <span style={{ fontSize: "var(--fs-medium)", lineHeight: 1, opacity: 0.7 }}>≡</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {props.renderItem(it)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
