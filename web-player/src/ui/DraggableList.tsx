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
  const draggedItem = drag.dragId ? props.items.find((item) => item.id === drag.dragId) : null;

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
                <span
                  aria-hidden
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 3px)",
                    gridAutoRows: "3px",
                    gap: 2,
                    opacity: 0.85,
                  }}
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span
                      key={`grip-dot-${i}`}
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: C.muted,
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>{props.renderItem(it)}</div>
            </div>
          </div>
        );
      })}
      {draggedItem && drag.pointerPos && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: drag.pointerPos.x + 14,
            top: drag.pointerPos.y + 10,
            zIndex: 1000,
            pointerEvents: "none",
            transform: "rotate(-2deg)",
            width: 280,
            maxWidth: "80vw",
            padding: "6px 10px",
            borderRadius: 8,
            border: `1px solid ${C.panelBorder}`,
            background: "rgba(18,24,40,0.97)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
            opacity: 0.95,
          }}
        >
          {props.renderItem(draggedItem)}
        </div>
      )}
    </div>
  );
}
