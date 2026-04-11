import React from "react";
import { theme } from "@/theme/theme";
import { IconPlus } from "@/icons";
import { IconButton } from "@/ui/IconButton";
import type { CampaignCharacter } from "@/domain/types/domain";
import { api, jsonInit } from "@/services/api";
import { NoteEditorFields, NoteList, NotesPanel } from "@beholden/shared/ui";

interface SharedNote {
  id: string;
  title: string;
  text: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  const [expandedIds, setExpandedIds] = React.useState<string[]>([]);
  const [dmNotes, setDmNotes] = React.useState<SharedNote[]>(() => parseNotes(props.campaignSharedNotes));
  const [editTarget, setEditTarget] = React.useState<EditTarget | null>(null);
  const [drawerTitle, setDrawerTitle] = React.useState("");
  const [drawerText, setDrawerText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

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

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    try {
      if (editTarget.source === "campaign") {
        let updated: SharedNote[];
        if (editTarget.noteId === null) {
          updated = [...dmNotes, { id: uid(), title: drawerTitle || "Note", text: drawerText }];
        } else {
          updated = dmNotes.map((n) =>
            n.id === editTarget.noteId ? { ...n, title: drawerTitle || "Note", text: drawerText } : n
          );
        }
        setDmNotes(updated);
        await api(`/api/campaigns/${props.campaignId}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(updated) }));
      } else {
        const player = props.players.find((p) => p.id === editTarget.playerId);
        const notes = parseNotes(player?.sharedNotes).map((n) =>
          n.id === editTarget.noteId ? { ...n, title: drawerTitle || "Note", text: drawerText } : n
        );
        await api(`/api/players/${editTarget.playerId}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(notes) }));
      }
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDm(noteId: string) {
    const updated = dmNotes.filter((n) => n.id !== noteId);
    setDmNotes(updated);
    await api(`/api/campaigns/${props.campaignId}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(updated) }));
  }

  async function handleDeletePlayer(noteId: string, playerId: string) {
    const player = props.players.find((p) => p.id === playerId);
    const notes = parseNotes(player?.sharedNotes).filter((n) => n.id !== noteId);
    await api(`/api/players/${playerId}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(notes) }));
  }

  async function handleReorderDm(ids: string[]) {
    if (ids.length !== dmNotes.length) return;
    const byId = new Map(dmNotes.map((note) => [note.id, note] as const));
    const reordered = ids.map((id) => byId.get(id)).filter((note): note is SharedNote => Boolean(note));
    if (reordered.length !== dmNotes.length) return;
    setDmNotes(reordered);
    await api(`/api/campaigns/${props.campaignId}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(reordered) }));
  }

  const accent = `var(--campaign-accent, ${theme.colors.accentPrimary})`;

  return (
    <>
      <NotesPanel
        storageKey="campaign-shared-notes"
        title={`Shared Notes (${totalCount})`}
        color={accent}
        actions={
          <IconButton onClick={openCreate} title="Add shared note" variant="accent">
            <IconPlus />
          </IconButton>
        }
      >
        {totalCount === 0 ? (
          <div style={{ color: theme.colors.muted }}>No shared notes yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {dmNotes.length > 0 ? (
              <NoteList
                items={dmNotes.map((note) => ({ id: campaignNoteKey(note.id), title: note.title || "Untitled", text: note.text }))}
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
                items={playerNotes.map(({ note, playerId }) => ({ id: playerNoteKey(playerId, note.id), title: note.title || "Untitled", text: note.text }))}
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
                {editTarget.noteId === null ? "New Shared Note" : "Edit Shared Note"}
              </span>
              <button onClick={() => setEditTarget(null)} style={{ all: "unset", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-title)", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <NoteEditorFields
                title={drawerTitle}
                text={drawerText}
                onTitleChange={setDrawerTitle}
                onTextChange={setDrawerText}
                textRows={10}
                titlePlaceholder="Note title"
                textPlaceholder="Note body"
                labelColor={theme.colors.muted}
                textColor={theme.colors.text}
                borderColor={theme.colors.panelBorder}
                inputBg={theme.colors.inputBg}
                radius={theme.radius.control}
              />
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${theme.colors.panelBorder}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setEditTarget(null)} style={{ padding: "8px 14px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: "transparent", color: theme.colors.text, cursor: "pointer", fontSize: "var(--fs-medium)", fontWeight: 700 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "8px 14px", borderRadius: theme.radius.control, border: "none", background: accent, color: theme.colors.textDark, cursor: saving ? "wait" : "pointer", fontSize: "var(--fs-medium)", fontWeight: 700, opacity: saving ? 0.7 : 1 }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

