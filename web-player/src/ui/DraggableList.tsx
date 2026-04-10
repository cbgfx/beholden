import React from "react";
import { usePointerDragReorder } from "@beholden/shared/ui/usePointerDragReorder";
import { C } from "@/lib/theme";

export type DragItem = { id: string };

export function DraggableList(props: {
  items: DragItem[];
  expandedIds?: string[];
  onSelect?: (id: string) => void;
  onReorder: (ids: string[]) => void;
  renderItem: (item: DragItem) => React.ReactNode;
}) {
  const drag = usePointerDragReorder({ items: props.items, onReorder: props.onReorder });

  return (
    <div>
      {drag.displayItems.map((it) => {
        const isExpanded = props.expandedIds?.includes(it.id) ?? false;
        const isDragging = drag.dragId === it.id;
        const bg = isExpanded
          ? "rgba(0,0,0,0.1)"
          : isDragging
            ? "rgba(0,0,0,0.08)"
            : "rgba(0,0,0,0.0)";

        return (
          <div
            key={it.id}
            ref={(el) => {
              drag.rowRefs.current[it.id] = el;
            }}
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
              <div
                title="Drag to reorder"
                role="button"
                aria-label="Drag to reorder"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => drag.onHandlePointerDown(e, it.id)}
                onPointerMove={drag.onHandlePointerMove}
                onPointerUp={() => drag.endDrag(true)}
                onPointerCancel={() => drag.endDrag(false)}
                style={{
                  width: 24,
                  height: 24,
                  marginTop: 2,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: `1px solid ${C.panelBorder}`,
                  background: "rgba(0,0,0,0.12)",
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  flex: "0 0 auto",
                  color: C.muted,
                }}
              >
                <span style={{ fontSize: "var(--fs-medium)", lineHeight: 1, opacity: 0.7 }}>===</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>{props.renderItem(it)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
