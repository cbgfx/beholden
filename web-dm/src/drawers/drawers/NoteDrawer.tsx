import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { TextArea } from "@/ui/TextArea";
import { api, jsonInit } from "@/services/api";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";

type NoteDrawerState = Exclude<Extract<DrawerState, { type: "note" } | { type: "editNote"; noteId: string }>, null>;

export function NoteDrawer(props: {
  drawer: NoteDrawerState;
  close: () => void;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (aid: string | null) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    const d = props.drawer;
    setTitle("");
    setText("");
    if (d.type !== "editNote") return;
    const n = [...state.campaignNotes, ...state.adventureNotes].find((x) => x.id === d.noteId);
    if (n) {
      setTitle(n.title);
      setText(n.text ?? "");
    }
  }, [props.drawer, state.adventureNotes, state.campaignNotes]);

  const submit = React.useCallback(async () => {
    const d = props.drawer;
    if (d.type === "note") {
      const t = title.trim() || "Note";
      const body = text ?? "";
      if (d.scope === "campaign") {
        await api(`/api/campaigns/${d.campaignId}/notes`, jsonInit("POST", { title: t, text: body }));
        await props.refreshCampaign(d.campaignId);
      } else {
        const aid = d.adventureId!;
        await api(`/api/adventures/${aid}/notes`, jsonInit("POST", { title: t, text: body }));
        await props.refreshAdventure(aid);
      }
      props.close();
      return;
    }

    await api(`/api/notes/${d.noteId}`, jsonInit("PUT", { title: title.trim() || "Note", text }));
    await props.refreshCampaign(state.selectedCampaignId);
    await props.refreshAdventure(state.selectedAdventureId);
    props.close();
  }, [props, state.selectedAdventureId, state.selectedCampaignId, text, title]);

  return {
    body: (
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>Title</div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8, marginTop: 6 }}>Text</div>
        <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write..." rows={10} />
      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={props.close}>
          Cancel
        </Button>
        <Button onClick={submit}>Save</Button>
      </div>
    )
  };
}
