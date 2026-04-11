import React from "react";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { TextArea } from "./TextArea";

export function NoteEditorFields(props: {
  title: string;
  text: string;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  titlePlaceholder?: string;
  textPlaceholder?: string;
  textRows?: number;
  labelColor: string;
  textColor: string;
  borderColor: string;
  inputBg: string;
  radius?: number;
}) {
  const radius = props.radius ?? 6;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FormField label="Title" labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: props.labelColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Input
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
          placeholder={props.titlePlaceholder ?? "Note title..."}
          theme={{ radius, panelBorder: props.borderColor, inputBg: props.inputBg, text: props.textColor }}
          style={{ width: "100%", boxSizing: "border-box", fontSize: "var(--fs-subtitle)", fontFamily: "inherit" }}
        />
      </FormField>
      <FormField label="Text" labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: props.labelColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <TextArea
          value={props.text}
          onChange={(event) => props.onTextChange(event.target.value)}
          placeholder={props.textPlaceholder ?? "Write..."}
          rows={props.textRows ?? 12}
          theme={{ radius, panelBorder: props.borderColor, inputBg: props.inputBg, text: props.textColor }}
          style={{ width: "100%", boxSizing: "border-box", resize: "vertical", fontSize: "var(--fs-subtitle)", padding: "8px 10px", fontFamily: "inherit", lineHeight: 1.5 }}
        />
      </FormField>
    </div>
  );
}
