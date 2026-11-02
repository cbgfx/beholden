import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
// web-dm/src/components/iconPicker/IconPicker.tsx
//
// A reusable, Notion-style icon picker. Knows nothing about Organizations,
// Positions, or POIs — callers just read/write an `icon` string (or null).

import { useState } from "react";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import { EntityIcon } from "./EntityIcon";
import { trimGameIconPrefix } from "@beholden/shared/ui/gameIconsCollection";
import { GameIconPickerDialog } from "@beholden/shared/ui/GameIconPickerDialog";

export function IconPicker(props: {
  value: string | null;
  onChange: (icon: string | null) => void;
  label?: string;
}) {
  const translateUi = useUiTranslation("dmUi");
  const [open, setOpen] = useState(false);
  const currentName = props.value ? trimGameIconPrefix(props.value) : null;

  return (
    <div style={{ display: "grid", gap: 7 }}>
      {props.label ? (
        <div style={{ fontSize: "var(--fs-medium)", opacity: 0.8 }}>
          {props.label}
        </div>
      ) : null}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          onDoubleClick={() => {
            if (props.value) props.onChange(null);
          }}
          title={props.value ? translateUi("Double-click to clear") : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: theme.radius.control,
            border: `1px dashed ${theme.colors.panelBorder}`,
            background: withAlpha(theme.colors.accentPrimary, 0.08),
            flex: "0 0 auto",
          }}
        >
          <EntityIcon icon={props.value} size={22} />
        </span>
        <span
          style={{
            fontSize: "var(--fs-body)",
            color: currentName ? theme.colors.text : theme.colors.muted,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {currentName ?? "No icon"}
        </span>
        <Button
          variant="ghost"
          onClick={() => setOpen(true)}
          style={{ fontSize: "var(--fs-subtitle)", padding: "5px 10px" }}
        >
          {translateUi("Change")}
        </Button>
      </div>
      {open ? (
        <GameIconPickerDialog
          value={props.value}
          onSelect={(icon) => {
            props.onChange(icon ?? null);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
