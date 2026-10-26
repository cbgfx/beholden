import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/theme";
import { RightDrawer } from "@/ui/RightDrawer";
import { NoteEditorFields, accentButtonStyle, ghostButtonStyle } from "@beholden/shared/ui";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";

export function NoteEditDrawer(props: {
  scope: "player" | "shared";
  note: PlayerNote | null;
  accentColor: string;
  onSave: (title: string, text: string) => void | Promise<unknown>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const translateUi = useUiTranslation("playerUi");
  const color = props.accentColor;
  const label = props.scope === "shared" ? "Shared Note" : "Player Note";
  const [title, setTitle] = useState(props.note?.title ?? "");
  const [text, setText] = useState(props.note?.text ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function save() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try { await props.onSave(title.trim() || "Note", text); }
    catch (cause) { if (active.current) setError(cause instanceof Error ? cause.message : translateUi("Unable to save note. Please try again.")); }
    finally { pending.current = false; if (active.current) setSaving(false); }
  }

  useEffect(() => {
    setTitle(props.note?.title ?? "");
    setText(props.note?.text ?? "");
  }, [props.note]);

  return (
    <RightDrawer
      onClose={() => { if (!pending.current) props.onClose(); }}
      width="min(400px, 90vw)"
      title={
        <span style={{ fontWeight: 900, fontSize: "var(--fs-subtitle)", letterSpacing: "0.08em", textTransform: "uppercase", color }}>
          {props.note ? translateUi("Edit {{value1}}", { value1: label }) : translateUi("New {{value1}}", { value1: label })}
        </span>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            {props.note && props.onDelete && (
              <button disabled={saving} onClick={props.onDelete} style={{ background: "rgba(255,93,93,0.12)", border: "1px solid rgba(255,93,93,0.3)", borderRadius: 8, color: C.red, cursor: "pointer", padding: "8px 16px", fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>
                {translateUi("Delete")}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={saving} onClick={props.onClose} style={ghostButtonStyle({ textColor: C.muted, borderColor: "rgba(255,255,255,0.16)", padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              {translateUi("Cancel")}
            </button>
            <button disabled={saving} onClick={() => void save()} style={accentButtonStyle(color, { padding: "8px 16px", fontSize: "var(--fs-subtitle)" })}>
              {translateUi(saving ? "Saving..." : "Save")}
            </button>
          </div>
        </div>
      }
    >
      {error && <div role="alert" style={{ color: C.red, marginBottom: 12 }}>{error}</div>}
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
