import { useEffect, useState } from "react";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { NoteEditorFields, accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";

export function NoteEditDrawer(props: {
  scope: "player" | "shared";
  note: PlayerNote | null;
  accentColor: string;
  onSave: (title: string, text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const color = props.accentColor;
  const label = props.scope === "shared" ? "Shared Note" : "Player Note";
  const [title, setTitle] = useState(props.note?.title ?? "");
  const [text, setText] = useState(props.note?.text ?? "");

  useEffect(() => {
    setTitle(props.note?.title ?? "");
    setText(props.note?.text ?? "");
  }, [props.note]);

  return (
    <RightDrawer
      onClose={props.onClose}
      width="min(400px, 90vw)"
      title={
        <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color }}>
          {props.note ? `Edit ${label}` : `New ${label}`}
        </span>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            {props.note && props.onDelete && (
              <button onClick={props.onDelete} style={{ background: "rgba(255,93,93,0.12)", border: "1px solid rgba(255,93,93,0.3)", borderRadius: 8, color: C.red, cursor: "pointer", padding: "8px 16px", fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={props.onClose} style={ghostButtonStyle({ textColor: C.muted, borderColor: "rgba(255,255,255,0.16)", padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              Cancel
            </button>
            <button onClick={() => props.onSave(title.trim() || "Note", text)} style={accentButtonStyle(color, { padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              Save
            </button>
          </div>
        </div>
      }
    >
      <NoteEditorFields
        title={title}
        text={text}
        onTitleChange={setTitle}
        onTextChange={setText}
        labelColor={C.muted}
        textColor={C.text}
        borderColor="rgba(255,255,255,0.12)"
        inputBg="rgba(255,255,255,0.06)"
      />
    </RightDrawer>
  );
}
