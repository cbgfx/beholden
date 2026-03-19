import React from "react";
import { theme, withAlpha } from "@/theme/theme";

export type DragItem = { id: string; title?: string; meta?: string };

/**
 * DraggableList: handle-only pointer drag reorder + selectable rows.
 * - Works on iPad (iOS Safari) because it does NOT rely on HTML5 drag-and-drop.
 * - Drag only starts from the handle (≡), so normal taps/scrolls behave normally.
 * - Selection is still row-based (click/tap row selects), handle never selects.
 *
 * For buttons inside renderItem, call e.stopPropagation().
 */
export function DraggableList(props: {
  items: DragItem[];
  activeId?: string | null;
  activeIds?: string[];
  onSelect?: (id: string) => void;
  onReorder: (ids: string[]) => void;
  renderItem?: (item: DragItem) => React.ReactNode;
}) {
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [orderIds, setOrderIds] = React.useState<string[] | null>(null);

  // Keep the latest order in a ref so pointer-up commits the correct order even if state batching happens.
  const orderIdsRef = React.useRef<string[] | null>(null);
  React.useEffect(() => {
    orderIdsRef.current = orderIds;
  }, [orderIds]);

  const dragStateRef = React.useRef<{
    startY: number;
    lastOverId: string | null;
    changed: boolean;
    pointerId: number;
  } | null>(null);

  const rowRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const displayItems = React.useMemo(() => {
    if (!orderIds) return props.items;
    const byId: Record<string, DragItem> = {};
    for (const it of props.items) byId[it.id] = it;
    return orderIds.map((id) => byId[id]).filter(Boolean);
  }, [orderIds, props.items]);

  React.useEffect(() => {
    // If parent updates items while we’re not dragging, clear any local ordering.
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
    // Pick the first item whose midpoint is below the pointer.
    // If none, return last item.
    const ids = (orderIdsRef.current ?? orderIds ?? props.items.map((i) => i.id)).filter(
      (id) => id !== draggingId
    );

    let last: string | null = null;
    for (const id of ids) {
      const el = rowRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      last = id;
      if (clientY < mid) return id;
    }
    return last;
  }

  function onHandlePointerDown(e: React.PointerEvent, id: string) {
    // Handle-only drag. Prevent click/select.
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setDragId(id);
    const ids = props.items.map((i) => i.id);
    setOrderIds(ids);
    orderIdsRef.current = ids;

    dragStateRef.current = {
      startY: e.clientY,
      lastOverId: null,
      changed: false,
      pointerId: e.pointerId,
    };
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragId || !dragStateRef.current) return;

    const st = dragStateRef.current;

    // Small activation threshold so taps don't reorder.
    if (Math.abs(e.clientY - st.startY) < 6) return;

    const overId = findOverId(e.clientY, dragId);
    if (!overId || overId === dragId) return;
    if (st.lastOverId === overId) return;

    st.lastOverId = overId;
    st.changed = true;
    reorderInState(dragId, overId);
  }

  function endDrag(commit: boolean) {
    const st = dragStateRef.current;
    dragStateRef.current = null;

    const ids =
      orderIdsRef.current ?? orderIds ?? props.items.map((i) => i.id);

    const shouldCommit = commit && !!st?.changed;

    setDragId(null);
    setOrderIds(null);
    orderIdsRef.current = null;

    if (shouldCommit) props.onReorder(ids);
  }

  return (
    <div>
      {displayItems.map((it) => {
        const isActive = props.activeIds
          ? props.activeIds.includes(it.id)
          : it.id === props.activeId;

        const isDragging = dragId === it.id;

        // Active/dragging highlights should follow the theme (no hardcoded mustard).
        const bg = isActive
          ? withAlpha(theme.colors.accentHighlight, 0.12)
          : isDragging
          ? withAlpha(theme.colors.accentHighlight, 0.08)
          : withAlpha(theme.colors.shadowColor, 0.14);

        return (
          <div
            key={it.id}
            ref={(el) => {
              rowRefs.current[it.id] = el;
            }}
            onClick={() => props.onSelect?.(it.id)}
            style={{
              borderRadius: 10,
              marginBottom: 4,
              userSelect: "none",
              cursor: props.onSelect ? "pointer" : "default",
              background: bg,
              border: `1px solid ${theme.colors.panelBorder}`,
              opacity: isDragging ? 0.92 : 1,
            }}
          >
            <div
              style={{
                padding: 4,
                borderRadius: 10,
                color: theme.colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              {/* Drag handle (works on iPad touch). */}
              <div
                title="Drag to reorder"
                role="button"
                aria-label="Drag to reorder"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => onHandlePointerDown(e, it.id)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={() => endDrag(true)}
                onPointerCancel={() => endDrag(false)}
                style={{
                  width: 28,
                  height: 28,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: withAlpha(theme.colors.shadowColor, 0.12),
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none", // critical for iOS: prevents scroll gesture stealing the drag
                  flex: "0 0 auto",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--fs-medium)",
                    lineHeight: 1,
                    opacity: 0.9,
                  }}
                >
                  ≡
                </span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {props.renderItem ? (
                  props.renderItem(it)
                ) : (
                  <div
                    style={{
                      borderRadius: 10,
                      color: theme.colors.text,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {it.title ?? it.id}
                    </span>

                    {it.meta ? (
                      <span
                        style={{
                          fontSize: "var(--fs-small)",
                          opacity: 0.75,
                          flex: "0 0 auto",
                        }}
                      >
                        {it.meta}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
