import React from "react";
import { NoteRow } from "./NoteRow";
import { usePointerDragReorder } from "./usePointerDragReorder";

export type NoteListItem = {
  id: string;
  title: string;
  text?: string;
};

export function NoteList(props: {
  items: NoteListItem[];
  expandedIds: string[];
  accentColor: string;
  textColor: string;
  mutedColor: string;
  deleteColor: string;
  onToggle: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onReorder?: (ids: string[]) => void;
  emptyText?: string;
}) {
  const canReorder = Boolean(props.onReorder) && props.items.length > 1;
  const drag = usePointerDragReorder({
    items: props.items,
    onReorder: (ids) => {
      if (!canReorder || !props.onReorder) return;
      props.onReorder(ids);
    },
  });
  const rows = canReorder ? drag.displayItems : props.items;

  if (!props.items.length) {
    return <div style={{ color: props.mutedColor }}>{props.emptyText ?? "No notes yet."}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 4 }}>
      {rows.map((item) => {
        const expanded = props.expandedIds.includes(item.id);
        const isDragging = drag.dragId === item.id;

        return (
          <div
            key={item.id}
            ref={(el) => {
              if (canReorder) drag.rowRefs.current[item.id] = el;
            }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              opacity: isDragging ? 0.9 : 1,
            }}
          >
            {canReorder ? (
              <button
                type="button"
                title="Drag to reorder"
                aria-label="Drag to reorder"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerDown={(event) => drag.onHandlePointerDown(event, item.id)}
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
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.12)",
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  flex: "0 0 auto",
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
                  {Array.from({ length: 6 }).map((_, index) => (
                    <span
                      key={`grip-dot-${item.id}-${index}`}
                      style={{
                        width: 3,
                        height: 3,
                        borderRadius: "50%",
                        background: props.mutedColor,
                        display: "block",
                      }}
                    />
                  ))}
                </span>
              </button>
            ) : null}

            <div style={{ flex: 1, minWidth: 0 }}>
              <NoteRow
                title={item.title || "Untitled"}
                text={item.text}
                expanded={expanded}
                accentColor={props.accentColor}
                textColor={props.textColor}
                mutedColor={props.mutedColor}
                deleteColor={props.deleteColor}
                onToggle={() => props.onToggle(item.id)}
                onEdit={props.onEdit ? () => props.onEdit?.(item.id) : undefined}
                onDelete={props.onDelete ? () => props.onDelete?.(item.id) : undefined}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
