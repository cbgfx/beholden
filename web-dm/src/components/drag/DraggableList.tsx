import React from "react";
import { usePointerDragReorder } from "@beholden/shared/ui/usePointerDragReorder";
import { theme, withAlpha } from "@/theme/theme";

export type DragItem = { id: string; title?: string; meta?: string };

export function DraggableList(props: {
  items: DragItem[];
  activeId?: string | null;
  activeIds?: string[];
  onSelect?: (id: string) => void;
  onReorder: (ids: string[]) => void;
  renderItem?: (item: DragItem) => React.ReactNode;
}) {
  const drag = usePointerDragReorder({ items: props.items, onReorder: props.onReorder });

  return (
    <div>
      {drag.displayItems.map((it) => {
        const isActive = props.activeIds
          ? props.activeIds.includes(it.id)
          : it.id === props.activeId;
        const isDragging = drag.dragId === it.id;

        const bg = isActive
          ? withAlpha(theme.colors.accentHighlight, 0.12)
          : isDragging
            ? withAlpha(theme.colors.accentHighlight, 0.08)
            : withAlpha(theme.colors.shadowColor, 0.14);

        return (
          <div
            key={it.id}
            ref={(el) => {
              drag.rowRefs.current[it.id] = el;
            }}
            onClick={() => props.onSelect?.(it.id)}
            style={{
              borderRadius: 10,
              marginBottom: 2,
              userSelect: "none",
              cursor: props.onSelect ? "pointer" : "default",
              background: bg,
              border: `1px solid ${theme.colors.panelBorder}`,
              opacity: isDragging ? 0.92 : 1,
            }}
          >
            <div
              style={{
                padding: 2,
                borderRadius: 10,
                color: theme.colors.text,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
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
                  width: 22,
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: `1px solid ${theme.colors.panelBorder}`,
                  background: withAlpha(theme.colors.shadowColor, 0.12),
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
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
                  ===
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
