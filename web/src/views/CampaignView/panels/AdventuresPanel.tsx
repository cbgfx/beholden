import React from "react";
import { Panel } from "../../../components/ui/Panel";
import { IconButton } from "../../../components/ui/IconButton";
import { DraggableList } from "../../../components/drag/DraggableList";
import { theme } from "../../../app/theme/theme";
import { IconChest, IconPencil, IconPlus, IconTrash } from "../../../components/icons";

export function AdventuresPanel(props: {
  adventures: { id: string; name: string }[];
  selectedAdventureId: string | null;
  onSelectAdventure: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const { adventures, selectedAdventureId } = props;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconChest /> Adventures ({adventures.length})
        </span>
      }
      actions={
        <IconButton onClick={props.onCreate} title="Add adventure" variant="solid">
          <IconPlus />
        </IconButton>
      }
    >
      {adventures.length ? (
        <DraggableList
          items={adventures.map((a) => ({ id: a.id, title: a.name }))}
          activeId={selectedAdventureId}
          onSelect={(id) => props.onSelectAdventure(id)}
          onReorder={props.onReorder}
          renderItem={(it) => (
            <div style={{ padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 900, color: theme.colors.text }}>{it.title ?? it.id}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <IconButton
                  title="Edit"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    props.onEdit(it.id);
                  }}
                >
                  <IconPencil />
                </IconButton>
                <IconButton
                  title="Delete"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    props.onDelete(it.id);
                  }}
                >
                  <IconTrash />
                </IconButton>
              </div>
            </div>
          )}
        />
      ) : (
        <div style={{ color: theme.colors.muted }}>No adventures yet.</div>
      )}
    </Panel>
  );
}
