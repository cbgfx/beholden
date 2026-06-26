import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { DraggableList } from "@/components/drag/DraggableList";
import { theme, withAlpha } from "@/theme/theme";
import { IconPencil, IconPlus, IconTrash, IconPlay, IconBuild, IconCopy, IconPlayer, IconINPC, IconMonster } from "@/icons";
import { RowMenu } from "@/ui/RowMenu";

function getStatusStyle(meta?: string) {
  const status = meta?.split("•", 1)[0]?.trim().toLowerCase();
  if (status === "complete") return { label: "Complete", color: theme.colors.muted, opacity: 0.55, rank: 2 };
  if (status === "in progress") return { label: "In Progress", color: theme.colors.accentWarning, opacity: 1, rank: 0 };
  return { label: "Open", color: theme.colors.muted, opacity: 1, rank: 1 };
}

export function EncountersPanel(props: {
  encounters: { id: string; name: string; status?: string | null }[];
  selectedAdventureId: string | null;
  selectedEncounterId: string | null;
  selectedEncounterCounts: { players: number; friendlies: number; hostiles: number } | null;
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
  const orderedEncounters = [...encounters].sort((a, b) => {
    const rankDiff = getStatusStyle(a.status ?? undefined).rank - getStatusStyle(b.status ?? undefined).rank;
    return rankDiff || encounters.indexOf(a) - encounters.indexOf(b);
  });

  return (
    <Panel
      storageKey="campaign-encounters"
      title={`Encounters (${encounters.length})`}
      actions={
        <IconButton onClick={props.onCreate} disabled={!selectedAdventureId} title="Add encounter" variant="accent">
          <IconPlus />
        </IconButton>
      }
    >
      {selectedAdventureId ? (
        encounters.length ? (
          <DraggableList
            items={orderedEncounters.map((e) => ({ id: e.id, title: e.name, meta: e.status ?? undefined }))}
            activeId={selectedEncounterId}
            onSelect={(id) => props.onSelectEncounter(id)}
            onReorder={props.onReorder}
            getItemStyle={(it) => {
              const status = getStatusStyle(it.meta);
              if (it.id === selectedEncounterId) {
                return {
                  background: `linear-gradient(90deg, ${withAlpha(theme.colors.accentHighlight, 0.12)}, ${withAlpha(theme.colors.accentHighlight, 0.025)} 30%, transparent 62%), ${withAlpha(theme.colors.shadowColor, 0.14)}`,
                  boxShadow: `inset 3px 0 0 ${withAlpha(theme.colors.accentHighlight, 0.78)}`,
                  opacity: status.opacity,
                };
              }
              if (status.label === "In Progress") {
                return {
                  background: `linear-gradient(90deg, ${withAlpha(status.color, 0.11)}, ${withAlpha(status.color, 0.025)} 28%, transparent 58%), ${withAlpha(theme.colors.shadowColor, 0.14)}`,
                  boxShadow: `inset 3px 0 0 ${withAlpha(status.color, 0.78)}`,
                  opacity: status.opacity,
                };
              }
              return {
                opacity: status.opacity,
              };
            }}
            renderItem={(it) => {
              const isSelected = it.id === selectedEncounterId;
              const counts = isSelected ? props.selectedEncounterCounts : null;
              const rosterMetrics = counts ? [
                { label: counts.players === 1 ? "Player" : "Players", value: counts.players, color: theme.colors.blue, icon: <IconPlayer size={12} /> },
                { label: counts.friendlies === 1 ? "Friendly" : "Friendlies", value: counts.friendlies, color: theme.colors.green, icon: <IconINPC size={12} /> },
                { label: counts.hostiles === 1 ? "Hostile" : "Hostiles", value: counts.hostiles, color: theme.colors.red, icon: <IconMonster size={12} /> },
              ] : [];

              return (
              <div className="campaignInteractiveRow" style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: theme.colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.title ?? it.id}
                  </div>
                  {it.meta ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{
                      padding: "1px 7px",
                      borderRadius: 999,
                      border: `1px solid ${getStatusStyle(it.meta).color}`,
                      color: getStatusStyle(it.meta).color,
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 900,
                      flex: "0 0 auto",
                    }}>
                      {getStatusStyle(it.meta).label}
                    </span>
                    <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {it.meta.split("•").slice(1).map((part) => part.trim()).filter(Boolean).join(" • ")}
                    </div>
                  </div>
                  ) : null}
                  {rosterMetrics.length ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", paddingTop: 2 }}>
                      {rosterMetrics.map((metric) => (
                        <span
                          key={metric.label}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: withAlpha(metric.color, 0.08),
                            color: metric.color,
                            fontSize: "var(--fs-tiny)",
                            fontWeight: 800,
                          }}
                        >
                          {metric.icon}
                          <span style={{ color: theme.colors.text }}>{metric.value}</span>
                          <span style={{ color: theme.colors.muted }}>{metric.label}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <div className="campaignRowActions" style={{ display: "inline-flex" }}>
                    <IconButton
                      title="Build roster"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onBuild(it.id);
                      }}
                    >
                      <IconBuild />
                    </IconButton>
                  </div>
                  <IconButton
                    title="Play"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onPlay(it.id);
                    }}
                  >
                    <IconPlay />
                  </IconButton>
                  <div className="campaignRowActions">
                    <RowMenu
                      items={[
                        { label: "Edit", icon: <IconPencil size={14} />, onClick: () => props.onEdit(it.id) },
                        { label: "Duplicate", icon: <IconCopy size={14} />, onClick: () => props.onDuplicate(it.id) },
                        { label: "Delete", icon: <IconTrash size={14} />, danger: true, onClick: () => props.onDelete(it.id) },
                      ]}
                    />
                  </div>
                </div>
              </div>
              );
            }}
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
