import React from "react";
import type { DrawerContent } from "@/drawers/types";
import { useStore } from "@/store";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { IconButton } from "@/ui/IconButton";
import { IconPencil } from "@/icons";
import { fetchNoteById } from "@/services/collectionApi";

export function AdventureNotesDrawer(props: { close: () => void }): DrawerContent {
  const { state, dispatch } = useStore();
  const notes = state.adventureNotes;
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => new Set());
  const [noteBodies, setNoteBodies] = React.useState<Record<string, string>>({});
  const [loadingIds, setLoadingIds] = React.useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = React.useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    const opening = !expandedIds.has(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    if (opening && !(id in noteBodies) && !loadingIds.has(id)) {
      setLoadingIds((previous) => new Set(previous).add(id));
      setFailedIds((previous) => {
        const next = new Set(previous);
        next.delete(id);
        return next;
      });
      void fetchNoteById(id)
        .then((note) => {
          setNoteBodies((previous) => ({ ...previous, [id]: note.text ?? "" }));
        })
        .catch(() => {
          setFailedIds((previous) => new Set(previous).add(id));
        })
        .finally(() => {
          setLoadingIds((previous) => {
            const next = new Set(previous);
            next.delete(id);
            return next;
          });
        });
    }
  }

  const highlight = theme.colors.accentHighlight;

  return {
    body: (
      <div style={{ display: "grid", alignContent: "start", gap: 8, height: "calc(100vh - 160px)", overflowY: "auto", minHeight: 420 }}>
        {notes.length === 0 ? (
          <div style={{ color: theme.colors.muted }}>No adventure notes yet.</div>
        ) : (
          notes.map((note) => {
            const expanded = expandedIds.has(note.id);
            const loading = loadingIds.has(note.id);
            const failed = failedIds.has(note.id);
            const body = noteBodies[note.id];
            return (
              <div
                key={note.id}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  background: expanded ? withAlpha(highlight, 0.07) : "transparent",
                  border: `1px solid ${expanded ? withAlpha(highlight, 0.22) : theme.colors.panelBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <button
                    onClick={() => toggle(note.id)}
                    style={{ all: "unset", cursor: "pointer", fontWeight: 900, color: theme.colors.text, flex: 1 }}
                  >
                    {expanded ? "▾" : "▸"} {note.title}
                  </button>
                  <IconButton
                    size="sm"
                    title="Edit note"
                    onClick={() => dispatch({ type: "openDrawer", drawer: { type: "editNote", noteId: note.id } })}
                  >
                    <IconPencil />
                  </IconButton>
                </div>

                {expanded && (
                  <div
                    className="bh-prewrap"
                    style={{ marginTop: 8, color: theme.colors.muted, lineHeight: 1.5 }}
                  >
                    {loading
                      ? <span style={{ fontStyle: "italic" }}>Loading note...</span>
                      : failed
                        ? <span style={{ fontStyle: "italic", color: theme.colors.colorPinkRed }}>Could not load note.</span>
                        : body?.trim()
                          ? body
                          : <span style={{ fontStyle: "italic" }}>No text.</span>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 8 }}>
        {state.selectedAdventureId ? (
          <Button
            variant="ghost"
            onClick={() =>
              dispatch({
                type: "openDrawer",
                drawer: {
                  type: "note",
                  scope: "adventure",
                  campaignId: state.selectedCampaignId,
                  adventureId: state.selectedAdventureId
                }
              })
            }
          >
            + Add note
          </Button>
        ) : null}
        <Button onClick={props.close}>Done</Button>
      </div>
    )
  };
}
