import { useTranslation } from "react-i18next";
import { FormField } from "./FormField";
import { Input } from "./Input";
import { WysiwygNoteEditor } from "./WysiwygNoteEditor";

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
  const { t } = useTranslation("shared");
  const radius = props.radius ?? 6;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FormField label={t("noteEditorFields.titleLabel")} labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: props.labelColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <Input
          value={props.title}
          onChange={(event) => props.onTitleChange(event.target.value)}
          placeholder={props.titlePlaceholder ?? t("noteEditorFields.titlePlaceholder")}
          theme={{ radius, panelBorder: props.borderColor, inputBg: props.inputBg, text: props.textColor }}
          style={{ width: "100%", boxSizing: "border-box", fontSize: "var(--fs-subtitle)", fontFamily: "inherit" }}
        />
      </FormField>
      <FormField label={t("noteEditorFields.textLabel")} labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: props.labelColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        <WysiwygNoteEditor
          value={props.text}
          onChange={props.onTextChange}
          placeholder={props.textPlaceholder ?? t("noteEditorFields.textPlaceholder")}
          minHeight={(props.textRows ?? 12) * 24}
          theme={{ radius, panelBorder: props.borderColor, inputBg: props.inputBg, text: props.textColor }}
          style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit" }}
        />
      </FormField>
    </div>
  );
}
