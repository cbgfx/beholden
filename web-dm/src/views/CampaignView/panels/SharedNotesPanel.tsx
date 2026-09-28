import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { theme } from "@/theme/theme";
import { IconPlus } from "@/icons";
import { IconButton } from "@/ui/IconButton";
import type { CampaignCharacter } from "@/domain/types/domain";
import { api, jsonInit } from "@/services/api";
import { NoteEditorFields, NoteList, NotesPanel } from "@beholden/shared/ui";
import { uid } from "@beholden/shared/domain/localId";

interface SharedNote {
  id: string;
  title: string;
  text: string;
}

function parseNotes(raw: string | undefined): SharedNote[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as SharedNote[]; } catch { return []; }
}

type EditTarget =
  | { source: "campaign"; noteId: string | null } // null = new note
  | { source: "player"; noteId: string; playerId: string };

export function SharedNotesPanel(props: {
  campaignId: string;
  campaignSharedNotes: string;
  players: CampaignCharacter[];
}) {
  const translateUi = useUiTranslation("dmUi");
  const [expandedIds, setExpandedIds] = React.useState<string[]>([]);
  const [dmNotes, setDmNotes] = React.useState<SharedNote[]>(() => parseNotes(props.campaignSharedNotes));
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [drawerTitle, setDrawerTitle] = React.useState("");
  const [drawerText, setDrawerText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Runs a change that has already been applied on screen, and puts the screen back if the server
   * refuses it. Without this an optimistic edit stayed visible after a failed save, so the panel
   * showed something the campaign did not have.
   */
  async function sendChange(send: () => Promise<unknown>, undo: () => void): Promise<boolean> {
    try {
      await send();
      setError(null);
      return true;
    } catch (cause) {
      undo();
      setError(cause instanceof Error ? cause.message : translateUi("Could not save that note."));
      return false;
    }
  }

  // Sync dmNotes when parent prop changes (e.g. after websocket refresh)
  React.useEffect(() => {
    setDmNotes(parseNotes(props.campaignSharedNotes));
  }, [props.campaignSharedNotes]);

  const playerNotes = React.useMemo(() =>
    props.players.flatMap((p) =>
      parseNotes(p.sharedNotes).map((note) => ({ note, playerId: p.id }))
    ),
    [props.players]
  );

  const totalCount = dmNotes.length + playerNotes.length;
  const campaignNoteKey = React.useCallback((noteId: string) => `campaign:${noteId}`, []);
  const playerNoteKey = React.useCallback((playerId: string, noteId: string) => `player:${playerId}:${noteId}`, []);

  function toggle(id: string) {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function openCreate() {
    setEditTarget({ source: "campaign", noteId: null });
    setDrawerTitle("");
    setDrawerText("");
  }

  function openEditDm(noteId: string) {
    const note = dmNotes.find((n) => n.id === noteId);
    if (!note) return;
    setEditTarget({ source: "campaign", noteId });
    setDrawerTitle(note.title);
    setDrawerText(note.text);
  }

  function openEditPlayer(noteId: string, playerId: string) {
    const player = props.players.find((p) => p.id === playerId);
    const note = parseNotes(player?.sharedNotes).find((n) => n.id === noteId);
    if (!note) return;
    setEditTarget({ source: "player", noteId, playerId });
    setDrawerTitle(note.title);
    setDrawerText(note.text);
  }

  // Each change is sent on its own rather than as a new copy of the whole list. A player editing
  // their own notes at the same moment used to mean one side's work was silently dropped, since
  // both were sending the list as it looked when they started.

  // A refused save leaves the editor open with the text still in it, rather than closing on a
  // change that never happened.
  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    const title = drawerTitle || "Note";
    const previous = dmNotes;
    try {
      let saved: boolean;
      if (editTarget.source === "campaign") {
        const noteId = editTarget.noteId ?? uid();
        setDmNotes((prev) => (prev.some((n) => n.id === noteId)
          ? prev.map((n) => (n.id === noteId ? { ...n, title, text: drawerText } : n))
          : [...prev, { id: noteId, title, text: drawerText }]));
        saved = await sendChange(
          () => api(`/api/campaigns/${props.campaignId}/sharedNotes/${noteId}`, jsonInit("PUT", { title, text: drawerText })),
          () => setDmNotes(previous),
        );
      } else {
        saved = await sendChange(
          () => api(
            `/api/players/${editTarget.playerId}/sharedNotes/${editTarget.noteId}`,
            jsonInit("PUT", { title, text: drawerText }),
          ),
          () => {},
        );
      }
      if (saved) setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDm(noteId: string) {
    const previous = dmNotes;
    setDmNotes((prev) => prev.filter((n) => n.id !== noteId));
    await sendChange(
      () => api(`/api/campaigns/${props.campaignId}/sharedNotes/${noteId}`, { method: "DELETE" }),
      () => setDmNotes(previous),
    );
  }

  async function handleDeletePlayer(noteId: string, playerId: string) {
    await sendChange(
      () => api(`/api/players/${playerId}/sharedNotes/${noteId}`, { method: "DELETE" }),
      () => {},
    );
  }

  async function handleReorderDm(ids: string[]) {
    const byId = new Map(dmNotes.map((note) => [note.id, note] as const));
    const reordered = ids.map((id) => byId.get(id)).filter((note): note is SharedNote => Boolean(note));
    if (reordered.length !== dmNotes.length) return;
    const previous = dmNotes;
    setDmNotes(reordered);
    await sendChange(
      () => api(`/api/campaigns/${props.campaignId}/sharedNotes/reorder`, jsonInit("POST", { ids })),
      () => setDmNotes(previous),
    );
  }

  const accent = `var(--campaign-accent, ${theme.colors.accentPrimary})`;

  return (
    <>
      <NotesPanel
        storageKey="campaign-shared-notes"
        title={translateUi("Shared Notes ({{value1}})", { value1: totalCount })}
        color={accent}
        borderColor="transparent"
        actions={
          <IconButton onClick={openCreate} title={translateUi("Add shared note")} variant="accent">
            <IconPlus />
          </IconButton>
        }
      >
        {totalCount === 0 ? (
          <div style={{ color: theme.colors.muted }}>{translateUi("No shared notes yet.")}</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {dmNotes.length > 0 ? (
              <NoteList
                items={dmNotes.map((note) => ({ id: campaignNoteKey(note.id), title: note.title, text: note.text }))}
                expandedIds={expandedIds}
                accentColor={accent}
                textColor={theme.colors.text}
                mutedColor={theme.colors.muted}
                deleteColor={theme.colors.red}
                onToggle={toggle}
                onEdit={(key) => {
                  const noteId = key.startsWith("campaign:") ? key.slice("campaign:".length) : key;
                  openEditDm(noteId);
                }}
                onDelete={(key) => {
                  const noteId = key.startsWith("campaign:") ? key.slice("campaign:".length) : key;
                  void handleDeleteDm(noteId);
                }}
                onReorder={(ids) => {
                  const rawIds = ids
                    .map((key) => (key.startsWith("campaign:") ? key.slice("campaign:".length) : key))
                    .filter(Boolean);
                  void handleReorderDm(rawIds);
                }}
              />
            ) : null}
            {playerNotes.length > 0 ? (
              <NoteList
                items={playerNotes.map(({ note, playerId }) => ({ id: playerNoteKey(playerId, note.id), title: note.title, text: note.text }))}
                expandedIds={expandedIds}
                accentColor={accent}
                textColor={theme.colors.text}
                mutedColor={theme.colors.muted}
                deleteColor={theme.colors.red}
                onToggle={(compositeId) => toggle(compositeId)}
                onEdit={(compositeId) => {
                  if (!compositeId.startsWith("player:")) return;
                  const payload = compositeId.slice("player:".length);
                  const sepIndex = payload.indexOf(":");
                  if (sepIndex < 0) return;
                  const playerId = payload.slice(0, sepIndex);
                  const noteId = payload.slice(sepIndex + 1);
                  openEditPlayer(noteId, playerId);
                }}
                onDelete={(compositeId) => {
                  if (!compositeId.startsWith("player:")) return;
                  const payload = compositeId.slice("player:".length);
                  const sepIndex = payload.indexOf(":");
                  if (sepIndex < 0) return;
                  const playerId = payload.slice(0, sepIndex);
                  const noteId = payload.slice(sepIndex + 1);
                  void handleDeletePlayer(noteId, playerId);
                }}
              />
            ) : null}
          </div>
        )}
      </NotesPanel>

      {/* Edit drawer */}
      {editTarget && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200 }}
          onClick={() => setEditTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: 340, maxWidth: "90vw",
              background: theme.colors.drawerBg,
              borderLeft: `1px solid ${theme.colors.panelBorder}`,
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.colors.panelBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {editTarget.noteId === null ? translateUi("New Shared Note") : translateUi("Edit Shared Note")}
              </span>
              <button onClick={() => setEditTarget(null)} style={{ all: "unset", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-title)", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {error ? (
                <div role="alert" style={{ fontSize: "var(--fs-small)", color: theme.colors.red }}>{error}</div>
              ) : null}
              <NoteEditorFields
                title={drawerTitle}
                text={drawerText}
                onTitleChange={setDrawerTitle}
                onTextChange={setDrawerText}
                textRows={10}
                labelColor={theme.colors.muted}
                textColor={theme.colors.text}
                borderColor={theme.colors.panelBorder}
                inputBg={theme.colors.inputBg}
                radius={theme.radius.control}
              />
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${theme.colors.panelBorder}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditTarget(null)} style={{ padding: "8px 14px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: "var(--fs-medium)", fontWeight: 700 }}>{translateUi("Cancel")}</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 14px", borderRadius: theme.radius.control, border: "none", background: accent, color: theme.colors.textDark, cursor: saving ? "wait" : "pointer", fontSize: "var(--fs-medium)", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>{translateUi("Save")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

