import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { DraggableList } from "@/components/drag/DraggableList";
import { theme } from "@/theme/theme";
import { IconPencil, IconPlus, IconTrash, IconDownload, IconImport } from "@/icons";
import { RowMenu } from "@/ui/RowMenu";

export function AdventuresPanel(props: {
  adventures: { id: string; name: string }[];
  selectedAdventureId: string | null;
  onSelectAdventure: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onExport: (id: string) => void;
  onImport: () => void;
}) {
  const { adventures, selectedAdventureId } = props;

  return (
    <Panel
      storageKey="campaign-adventures"
      title={`Adventures (${adventures.length})`}
      actions={
        <div style={{ display: "inline-flex", gap: 4 }}>
          <IconButton onClick={props.onImport} title="Import adventure">
            <IconImport />
          </IconButton>
          <IconButton onClick={props.onCreate} title="Add adventure" variant="accent">
            <IconPlus />
          </IconButton>
        </div>
      }
    >
      {adventures.length ? (
        <DraggableList
          items={adventures.map((a) => ({ id: a.id, title: a.name }))}
          activeId={selectedAdventureId}
          onSelect={(id) => props.onSelectAdventure(id)}
          onReorder={props.onReorder}
          renderItem={(it) => (
            <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontWeight: 900, color: theme.colors.text }}>{it.title ?? it.id}</div>
              <RowMenu
                items={[
                  { label: "Edit", icon: <IconPencil size={14} />, onClick: () => props.onEdit(it.id) },
                  { label: "Export", icon: <IconDownload size={14} />, onClick: () => props.onExport(it.id) },
                  { label: "Delete", icon: <IconTrash size={14} />, danger: true, onClick: () => props.onDelete(it.id) },
                ]}
              />
            </div>
          )}
        />
      ) : (
        <div style={{ color: theme.colors.muted }}>No adventures yet.</div>
      )}
    </Panel>
  );
}
