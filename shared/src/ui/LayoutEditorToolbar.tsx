import type { ButtonHTMLAttributes, ReactNode } from "react";
import { IconPalette } from "../icons/PaletteIcon";
import { useUiTranslation } from "../i18n/useUiTranslation";
import type { CSSProperties } from "react";
import { LAYOUT_COLORS as C } from "./layoutTheme";
import { withAlpha } from "./colors";
type PanelColorSettings = {
  accent?: string;
  background?: string;
  text?: string;
};
type LayoutEditorView = { id: string; name: string; columns: number };
function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      style={{
        ...toolbarButtonStyle(Boolean(props.disabled)),
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...props.style,
      }}
    />
  );
}

function IconCopy() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </svg>
  );
}

export function LayoutEditorToolbar(props: {
  activeView: LayoutEditorView;
  panels: { id: string; title: string }[];
  minColumns: number;
  maxColumns: number;
  trailing?: ReactNode;
  disabled?: boolean;
  protectedView: boolean;
  canReset: boolean;
  canDelete: boolean;
  canDuplicate?: boolean;
  renameDisabledReason?: string;
  deleteDisabledReason?: string;
  onRename: (name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
  onReset: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  colorsOpen: boolean;
  colorTarget: string;
  globalColors: Required<PanelColorSettings>;
  onToggleColors: () => void;
  onColorTargetChange: (target: string) => void;
  onColorChange: (key: keyof PanelColorSettings, value: string) => void;
  onResetColors: () => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const { activeView } = props;
  return (
    <fieldset
      disabled={props.disabled}
      style={{
        border: 0,
        padding: 0,
        margin: 0,
        minWidth: 0,
        display: "grid",
        justifyItems: "center",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <input
          key={activeView.id}
          aria-label={translateUi("View name")}
          defaultValue={activeView.name}
          disabled={props.protectedView}
          title={props.protectedView ? props.renameDisabledReason : undefined}
          onBlur={(event) => {
            const name = event.currentTarget.value.trim();
            if (name && name !== activeView.name) props.onRename(name);
            else event.currentTarget.value = activeView.name;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = activeView.name;
              event.currentTarget.blur();
            }
          }}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: "var(--fs-small)",
            fontWeight: 700,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.04)",
            color: C.text,
            minWidth: 140,
            opacity: props.protectedView ? 0.55 : 1,
            cursor: props.protectedView ? "not-allowed" : "text",
          }}
        />
        <button
          type="button"
          onClick={props.onAddColumn}
          disabled={activeView.columns >= props.maxColumns}
          style={toolbarButtonStyle(activeView.columns >= props.maxColumns)}
        >
          {translateUi("+ Column")}
        </button>
        <button
          type="button"
          onClick={props.onRemoveColumn}
          disabled={activeView.columns <= props.minColumns}
          style={toolbarButtonStyle(activeView.columns <= props.minColumns)}
        >
          {translateUi("− Column")}
        </button>
        <IconButton
          onClick={props.onReset}
          disabled={!props.canReset}
          title={
            props.canReset
              ? translateUi("Reset this view")
              : translateUi("Only built-in views have a default layout")
          }
          aria-label={translateUi("Reset this view")}
        >
          <IconReset />
        </IconButton>
        <IconButton
          onClick={props.onToggleColors}
          title={translateUi("Colours")}
          aria-label={translateUi("Colours")}
        >
          <IconPalette />
        </IconButton>
        <IconButton
          onClick={props.onDuplicate}
          disabled={props.canDuplicate === false}
          title={translateUi("Duplicate this view")}
        >
          <IconCopy />
        </IconButton>
        <IconButton
          onClick={props.onDelete}
          disabled={!props.canDelete}
          title={
            props.canDelete
              ? translateUi("Delete this view")
              : (props.deleteDisabledReason ??
                translateUi("At least one view must remain"))
          }
          style={{
            color: C.red,
            borderColor: withAlpha(C.red, 0.4),
            background: withAlpha(C.red, 0.08),
          }}
        >
          <IconTrash />
        </IconButton>
        {props.trailing}
      </div>
      {props.colorsOpen && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.025)",
          }}
        >
          <select
            aria-label={translateUi("Colour target")}
            value={props.colorTarget}
            onChange={(event) =>
              props.onColorTargetChange(event.target.value as string)
            }
            style={{ ...toolbarButtonStyle(false), background: C.bg }}
          >
            <option value="all">{translateUi("All panels")}</option>
            {props.panels.map(({ id, title }) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
          {(
            [
              ["accent", "Accent"],
              ["background", "Panel background"],
              ["text", "Text"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: C.muted,
                fontSize: "var(--fs-small)",
              }}
            >
              {translateUi(label)}
              <input
                type="color"
                aria-label={translateUi(label)}
                value={props.globalColors[key]}
                onChange={(event) =>
                  props.onColorChange(key, event.target.value)
                }
                style={{
                  width: 28,
                  height: 28,
                  padding: 0,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                }}
              />
            </label>
          ))}
          <button
            type="button"
            onClick={props.onResetColors}
            style={toolbarButtonStyle(false)}
          >
            {translateUi("Reset colours")}
          </button>
        </div>
      )}
    </fieldset>
  );
}

function toolbarButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    fontSize: "var(--fs-small)",
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "transparent",
    color: disabled ? "rgba(160,180,220,0.35)" : C.muted,
    opacity: disabled ? 0.6 : 1,
  };
}
