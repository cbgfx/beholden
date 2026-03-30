import React from "react";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { IconNotes, IconPlus } from "@/icons";
import { IconButton } from "@/ui/IconButton";
import type { Player } from "@/domain/types/domain";
import { api, jsonInit } from "@/services/api";

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
  players: Player[];
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

  const accent = theme.colors.accentPrimary;

  return (
    <>
      <Panel
        storageKey="campaign-shared-notes"
        title={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <IconNotes /> Shared Notes ({totalCount})
          </span>
        }
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
            {dmNotes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                expanded={expandedIds.includes(note.id)}
                accentColor={accent}
                onToggle={() => toggle(note.id)}
                onEdit={() => openEditDm(note.id)}
                onDelete={() => handleDeleteDm(note.id)}
              />
            ))}
            {playerNotes.map(({ note, playerId }) => (
              <NoteRow
                key={note.id}
                note={note}
                expanded={expandedIds.includes(note.id)}
                accentColor={accent}
                onToggle={() => toggle(note.id)}
                onEdit={() => openEditPlayer(note.id, playerId)}
                onDelete={() => handleDeletePlayer(note.id, playerId)}
              />
            ))}
          </div>
        )}
      </Panel>

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
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "var(--fs-subtitle)", fontWeight: 600, color: theme.colors.muted }}>Title</label>
                <input
                  value={drawerTitle}
                  onChange={(e) => setDrawerTitle(e.target.value)}
                  placeholder="Note title"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, fontSize: "var(--fs-medium)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: "var(--fs-subtitle)", fontWeight: 600, color: theme.colors.muted }}>Body</label>
                <textarea
                  value={drawerText}
                  onChange={(e) => setDrawerText(e.target.value)}
                  placeholder="Note body"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: theme.radius.control, border: `1px solid ${theme.colors.panelBorder}`, background: theme.colors.inputBg, color: theme.colors.text, fontSize: "var(--fs-medium)", outline: "none", minHeight: 140, resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
                />
              </div>
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

function NoteRow(props: {
  note: SharedNote;
  expanded: boolean;
  accentColor: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { note, expanded, accentColor } = props;
  return (
    <div style={{
      padding: "5px 6px", borderRadius: 7,
      background: expanded ? withAlpha(accentColor, 0.07) : "transparent",
      border: `1px solid ${expanded ? withAlpha(accentColor, 0.22) : "transparent"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
          style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: theme.colors.text, flex: 1 }}
        >
          {note.title || "Untitled"}
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onEdit(); }}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: theme.colors.muted, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
        >
          Edit
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onDelete(); }}
          style={{ background: "rgba(255,93,93,0.08)", border: "1px solid rgba(255,93,93,0.25)", borderRadius: 5, color: theme.colors.red, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}
        >
          ×
        </button>
      </div>
      {expanded && note.text && (
        <div style={{ marginTop: 6, color: theme.colors.muted, fontSize: "var(--fs-subtitle)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {note.text}
        </div>
      )}
    </div>
  );
}
