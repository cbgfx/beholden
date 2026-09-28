import * as React from "react";
import { useUiTranslation } from "../../i18n/useUiTranslation";
import { IconPencil, IconPlus, IconTrash } from "../../icons";
import type { CompendiumEntryEditing, Ruleset } from "./CompendiumHost";
import { COMPENDIUM_COLORS as C, CompendiumButton, CompendiumIconButton } from "./compendiumStyle";

/**
 * Edit and delete buttons at the end of a compendium row, with an inline "Delete? Yes / No"
 * confirmation. Only rendered when the app supplies editing for this kind of entry.
 */
export function EntryRowActions(props: {
  editing: CompendiumEntryEditing;
  id: string;
  ruleset?: Ruleset;
  /** Shown in the tooltips, e.g. "spell" gives "Edit spell". */
  noun: "spell" | "monster" | "item";
  /** Row hover, so the buttons can dim when the row is not in use. */
  hovered: boolean;
  onError: (message: string) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState<"edit" | "delete" | null>(null);

  const run = async (kind: "edit" | "delete", action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
      if (kind === "delete") setConfirming(false);
    } catch (error) {
      props.onError(error instanceof Error ? error.message : translateUi("That did not work. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const titles = {
    spell: { edit: translateUi("Edit spell"), delete: translateUi("Delete spell") },
    monster: { edit: translateUi("Edit monster"), delete: translateUi("Delete monster") },
    item: { edit: translateUi("Edit item"), delete: translateUi("Delete item") },
  }[props.noun];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 8px",
        flexShrink: 0,
        opacity: props.hovered || confirming ? 1 : 0.65,
        transition: "opacity 0.1s",
      }}
    >
      {confirming ? (
        <>
          <span style={{ fontSize: "var(--fs-small)", color: C.muted, marginRight: 4 }}>{translateUi("Delete?")}</span>
          <CompendiumButton
            type="button"
            variant="danger"
            disabled={busy === "delete"}
            title={translateUi("Yes, delete")}
            onClick={() => run("delete", () => props.editing.remove(props.id, props.ruleset))}
          >
            {translateUi("Yes")}
          </CompendiumButton>
          <CompendiumButton type="button" variant="ghost" title={translateUi("Cancel")} onClick={() => setConfirming(false)}>
            {translateUi("No")}
          </CompendiumButton>
        </>
      ) : (
        <>
          <CompendiumIconButton
            variant="ghost"
            size="sm"
            title={titles.edit}
            disabled={busy === "edit"}
            onClick={() => run("edit", () => props.editing.edit(props.id, props.ruleset))}
          >
            {busy === "edit" ? <span style={{ fontSize: "var(--fs-tiny)" }}>...</span> : <IconPencil size={13} />}
          </CompendiumIconButton>
          <CompendiumIconButton variant="ghost" size="sm" title={titles.delete} onClick={() => setConfirming(true)}>
            <IconTrash size={13} />
          </CompendiumIconButton>
        </>
      )}
    </div>
  );
}

/** The + button in a browser's header that opens the create form. */
export function BrowserAddButton(props: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: 8,
        border: `1px solid ${C.panelBorder}`,
        background: C.accent,
        color: C.textDark,
        cursor: "pointer",
      }}
    >
      <IconPlus size={14} />
    </button>
  );
}

/** The count (or "Loading...") in a browser's header, with the add button when editing is on. */
export function BrowserHeaderActions(props: { busy: boolean; count: number; addTitle: string; editing?: CompendiumEntryEditing }) {
  const translateUi = useUiTranslation("sharedUi");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{props.busy ? translateUi("Loading...") : props.count.toLocaleString()}</div>
      {props.editing ? <BrowserAddButton title={props.addTitle} onClick={() => props.editing!.create()} /> : null}
    </div>
  );
}
