import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import React from "react";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { createAdventureNote, createCampaignNote, fetchNoteById } from "@/services/collectionApi";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { theme } from "@/theme/theme";
import { NoteEditorFields } from "@beholden/shared/ui";

type NoteDrawerState = Exclude<Extract<DrawerState, { type: "note" } | { type: "editNote"; noteId: string }>, null>;

export function NoteDrawer(props: {
  drawer: NoteDrawerState;
  close: () => void;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
}): DrawerContent {
  const translateUi = useUiTranslation("dmUi");
  const { state } = useStore();
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  // What the note is listed as while it has no title of its own: its first line.
  const [derivedTitle, setDerivedTitle] = React.useState("");
  // Which note the boxes were filled from. Once they hold what someone is typing, a refreshed
  // note list must not overwrite them: any change anywhere in the campaign refetches that list,
  // so a second DM saving a note used to wipe whatever the first one had typed so far.
  const filledFrom = React.useRef<string | null>(null);
  // Set as soon as anyone types, so a late arriving fetch cannot land on top of their words.
  const edited = React.useRef(false);
  // What the server had when this note was opened, so a save can send only what actually changed.
  // Sending both fields every time meant two DMs editing one note - one the title, one the text -
  // overwrote each other for no reason.
  const loaded = React.useRef<{ title: string; text: string }>({ title: "", text: "" });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const d = props.drawer;
    const opened = d.type === "editNote" ? d.noteId : "new";
    if (filledFrom.current === opened) return;

    if (d.type !== "editNote") {
      filledFrom.current = opened;
      edited.current = false;
      loaded.current = { title: "", text: "" };
      setError(null);
      setTitle("");
      setText("");
      setDerivedTitle("");
      return;
    }

    const n = [...state.campaignNotes, ...state.adventureNotes].find((x) => x.id === d.noteId);
    // The list may not have arrived yet; try again when it does rather than showing empty boxes.
    if (!n) return;

    filledFrom.current = opened;
    edited.current = false;
    setError(null);
    // The stored title, which is the sentinel while the note has none of its own.
    loaded.current = { title: n.titleIsDerived ? "Note" : n.title, text: n.text ?? "" };
    // A title worked out from the text belongs in the placeholder, not the box. Putting it in the
    // box meant opening a note and saving it froze that first line as the title for good.
    setTitle(n.titleIsDerived ? "" : n.title);
    setDerivedTitle(n.titleIsDerived ? n.title : "");
    setText(n.text ?? "");
    if (n.text) return;
    let cancelled = false;
    setLoading(true);
    fetchNoteById(d.noteId)
      .then((full) => {
        if (cancelled || edited.current) return;
        loaded.current = { title: full.titleIsDerived ? "Note" : full.title ?? "", text: full.text ?? "" };
        setTitle(full.titleIsDerived ? "" : full.title ?? "");
        setDerivedTitle(full.titleIsDerived ? full.title ?? "" : "");
        setText(full.text ?? "");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [props.drawer, state.adventureNotes, state.campaignNotes]);

  // A failed save keeps the drawer open with everything still in it, and says what went wrong.
  // It used to close regardless, so the note simply did not save and nothing said so.
  const submit = React.useCallback(async () => {
    const d = props.drawer;
    setSaving(true);
    setError(null);
    try {
      if (d.type === "note") {
        const t = title.trim() || "Note";
        const body = text ?? "";
        if (d.scope === "campaign") {
          await createCampaignNote(d.campaignId, { title: t, text: body });
        } else {
          const aid = d.adventureId!;
          await createAdventureNote(aid, { title: t, text: body });
        }
        props.close();
        return;
      }

      // Only the fields that actually changed, so a save cannot undo somebody else's edit to the
      // other one.
      const nextTitle = title.trim() || "Note";
      const changes: { title?: string; text?: string } = {};
      if (nextTitle !== loaded.current.title) changes.title = nextTitle;
      if (text !== loaded.current.text) changes.text = text;
      if (Object.keys(changes).length > 0) {
        await api(`/api/notes/${d.noteId}`, jsonInit("PUT", changes));
      }
      props.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : translateUi("Could not save this note."));
    } finally {
      setSaving(false);
    }
  }, [props, text, title, translateUi]);

  return {
    body: (
      <div style={{ display: "grid", gap: 10 }}>
        {loading ? <div style={{ fontSize: "var(--fs-small)", opacity: 0.7 }}>{translateUi("Loading note content...")}</div> : null}
        {error ? <div role="alert" style={{ fontSize: "var(--fs-small)", color: theme.colors.red }}>{error}</div> : null}
        <NoteEditorFields
          {...(derivedTitle ? { titlePlaceholder: derivedTitle } : {})}
          title={title}
          text={text}
          onTitleChange={(value) => { edited.current = true; setTitle(value); }}
          onTextChange={(value) => { edited.current = true; setText(value); }}
          textRows={10}
          labelColor={theme.colors.muted}
          textColor={theme.colors.text}
          borderColor={theme.colors.panelBorder}
          inputBg={theme.colors.inputBg}
          radius={theme.radius.control}
        />
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>
          {translateUi("Cancel")}
        </Button>
        <Button onClick={submit} disabled={saving}>{translateUi("Save")}</Button>
      </div>
    )
  };
}
