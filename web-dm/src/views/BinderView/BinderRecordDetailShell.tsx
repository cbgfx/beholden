// web-dm/src/views/BinderView/BinderRecordDetailShell.tsx
// Shared detail-view scaffold for a single Binder record: back link, accent-striped article,
// header row (leading portrait/icon, name, visibility/edit/delete actions), and a body slot for
// whatever fields the record type needs. Used by ReferenceWorkspace and MortalWorkspace, which
// differ in real ways (Reference supports inline name editing, Mortal doesn't; action-button size
// and body spacing differ) — those differences are exposed as props rather than papered over.
import type { ReactNode } from "react";
import { IconPencil, IconTrash } from "@/icons";
import { Input } from "@/ui/Input";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";
import { VisibilityIcon } from "./VisibilityIcon";

type DetailName =
  | { editable: false; value: string }
  | {
      editable: true;
      value: string;
      ariaLabel: string;
      disabled?: boolean;
      onChange: (value: string) => void;
      onCommit: () => void;
      onCancel: () => void;
    };

export function BinderRecordDetailShell(props: {
  onBack: () => void;
  backLabel: string;
  accent: string;
  leading?: ReactNode;
  leadingAlign?: "start" | "center";
  name: DetailName;
  canEdit: boolean;
  recordLabel: string;
  visibilityPublic: boolean;
  onVisibilityChange: () => void;
  visibilityBusy?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  actionButtonSize?: { width: number; height: number };
  bodyPadding?: number;
  bodyGap?: number;
  bodyMaxWidth?: number;
  children: ReactNode;
}) {
  const name = props.name;
  const size = props.actionButtonSize ?? { width: 38, height: 36 };
  const actionButtonStyle = {
    width: size.width,
    height: size.height,
    padding: 0,
    borderRadius: theme.radius.control,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  } as const;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <button
        type="button"
        onClick={props.onBack}
        style={{ width: "fit-content", border: 0, background: "transparent", color: theme.colors.muted, cursor: "pointer", padding: 0, fontSize: "var(--fs-medium)" }}
      >
        ← All {props.backLabel}
      </button>
      <article style={{ border: `1px solid ${withAlpha(props.accent, 0.3)}`, borderRadius: theme.radius.panel, background: theme.colors.panelBg, overflow: "hidden" }}>
        <div style={{ height: 4, background: props.accent }} />
        <div style={{ padding: props.bodyPadding ?? 24, display: "grid", gap: props.bodyGap ?? 18, maxWidth: props.bodyMaxWidth }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", gap: 16, alignItems: props.leadingAlign ?? "start", flex: "1 1 auto" }}>
              {props.leading}
              {name.editable ? (
                <Input
                  aria-label={name.ariaLabel}
                  value={name.value}
                  disabled={name.disabled}
                  onChange={(event) => name.onChange(event.target.value)}
                  onBlur={() => name.onCommit()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") {
                      name.onCancel();
                      event.currentTarget.blur();
                    }
                  }}
                  style={{ width: "min(720px, 100%)", padding: "3px 7px", borderColor: "transparent", background: "transparent", fontSize: "calc(var(--fs-hero) * 0.9)", fontWeight: 850 }}
                />
              ) : (
                <h2 style={{ margin: 0, fontSize: "calc(var(--fs-hero) * 0.9)" }}>{name.value}</h2>
              )}
            </div>
            {props.canEdit ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={props.visibilityPublic ? `Make ${props.recordLabel} private` : `Make ${props.recordLabel} public`}
                  title={props.visibilityPublic ? "Public — click to make private" : "Private — click to make public"}
                  disabled={props.visibilityBusy}
                  onClick={props.onVisibilityChange}
                  style={{ ...actionButtonStyle, border: `1px solid ${props.visibilityPublic ? withAlpha(props.accent, 0.65) : theme.colors.panelBorder}`, background: props.visibilityPublic ? withAlpha(props.accent, 0.16) : "transparent", color: props.visibilityPublic ? props.accent : theme.colors.muted, cursor: props.visibilityBusy ? "default" : "pointer" }}
                >
                  <VisibilityIcon visible={props.visibilityPublic} size={19} />
                </Button>
                <Button type="button" variant="ghost" aria-label={`Edit ${props.recordLabel}`} title="Edit" onClick={props.onEdit} style={{ ...actionButtonStyle, color: theme.colors.text }}>
                  <IconPencil size={17} />
                </Button>
                <Button type="button" variant="danger" aria-label={`Delete ${props.recordLabel}`} title="Delete" onClick={props.onDelete} style={actionButtonStyle}>
                  <IconTrash size={17} />
                </Button>
              </div>
            ) : null}
          </div>
          {props.children}
        </div>
      </article>
    </div>
  );
}
