import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { DraggableList } from "@/components/drag/DraggableList";
import { theme } from "@/theme/theme";
import { IconEncounter, IconPencil, IconPlus, IconTrash, IconPlay, IconBuild, IconCopy } from "@/icons";
import { RowMenu } from "@/ui/RowMenu";

export function EncountersPanel(props: {
  encounters: { id: string; name: string; status?: string | null }[];
  selectedAdventureId: string | null;
  selectedEncounterId: string | null;
  onSelectEncounter: (id: string) => void;
  onPlay: (id: string) => void;
  onBuild: (id: string) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const { encounters, selectedAdventureId, selectedEncounterId } = props;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconEncounter /> Encounters ({encounters.length})
        </span>
      }
      actions={
        <IconButton onClick={props.onCreate} disabled={!selectedAdventureId} title="Add encounter">
          <IconPlus />
        </IconButton>
      }
    >
      {selectedAdventureId ? (
        encounters.length ? (
          <DraggableList
            items={encounters.map((e) => ({ id: e.id, title: e.name, meta: e.status ?? undefined }))}
            activeId={selectedEncounterId}
            onSelect={(id) => props.onSelectEncounter(id)}
            onReorder={props.onReorder}
            renderItem={(it) => (
              <div style={{ padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontWeight: 900, color: theme.colors.text }}>{it.title ?? it.id}</div>
                  {it.meta ? <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted }}>{it.meta}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <IconButton
                    title="Build roster"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onBuild(it.id);
                    }}
                  >
                    <IconBuild />
                  </IconButton>
                  <IconButton
                    title="Play"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onPlay(it.id);
                    }}
                  >
                    <IconPlay />
                  </IconButton>
                  <RowMenu
                    items={[
                      { label: "Edit", icon: <IconPencil size={14} />, onClick: () => props.onEdit(it.id) },
                      { label: "Duplicate", icon: <IconCopy size={14} />, onClick: () => props.onDuplicate(it.id) },
                      { label: "Delete", icon: <IconTrash size={14} />, danger: true, onClick: () => props.onDelete(it.id) },
                    ]}
                  />
                </div>
              </div>
            )}
          />
        ) : (
          <div style={{ color: theme.colors.muted }}>No encounters yet.</div>
        )
      ) : (
        <div style={{ color: theme.colors.muted }}>Select an adventure.</div>
      )}
    </Panel>
  );
}
