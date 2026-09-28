import * as React from "react";
import { useWs } from "../../ui/webSocket";

export type Ruleset = "5e" | "5.5e";

/** The panel frame each app draws around its screens (title bar, border, collapse). */
export type CompendiumPanelProps = {
  title: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  /** Remembers whether the panel is collapsed, per browser. */
  storageKey?: string;
};

/**
 * Editing of one kind of entry. Supplied only by the DM app; without it the compendium is
 * read-only and shows no add, edit or delete controls.
 */
export type CompendiumEntryEditing = {
  /** Opens the create form. `onCreated` is called with the new entry, where the editor reports it. */
  create: (onCreated?: (id: string, ruleset?: Ruleset) => void) => void;
  /** Loads the entry and opens its editor. The row shows a busy state until this settles. */
  edit: (id: string, ruleset?: Ruleset) => Promise<void>;
  remove: (id: string, ruleset?: Ruleset) => Promise<void>;
};

export type CompendiumEditableKind = "spells" | "monsters" | "items";

export type CompendiumHostValue = {
  Panel: React.ComponentType<CompendiumPanelProps>;
  editing?: Partial<Record<CompendiumEditableKind, CompendiumEntryEditing>>;
  /** Increases whenever the compendium changes; lists and details reload when it does. */
  revision: number;
};

const CompendiumHostContext = React.createContext<CompendiumHostValue | null>(null);

export function CompendiumHostProvider(props: { value: CompendiumHostValue; children: React.ReactNode }) {
  return <CompendiumHostContext.Provider value={props.value}>{props.children}</CompendiumHostContext.Provider>;
}

export function useCompendiumHost(): CompendiumHostValue {
  const host = React.useContext(CompendiumHostContext);
  if (!host) throw new Error("Compendium components must be rendered inside a CompendiumHostProvider.");
  return host;
}

/**
 * A revision counter for the compendium. It goes up when the server reports a change (an import,
 * or an edit from any DM) and when `bump` is called after a local edit, so lists and details
 * reload without each one having to be told.
 */
export function useCompendiumRevision(): [number, () => void] {
  const [revision, setRevision] = React.useState(0);
  const bump = React.useCallback(() => setRevision((value) => value + 1), []);
  useWs((message) => {
    if (message.type === "compendium:changed") bump();
  });
  return [revision, bump];
}

/**
 * Calls `onChange` when the revision moves on from the value seen at mount, so a list refreshes
 * after an edit or import but not on its first render.
 */
export function useOnRevisionChange(revision: number, onChange: () => void) {
  const seen = React.useRef(revision);
  React.useEffect(() => {
    if (revision === seen.current) return;
    seen.current = revision;
    onChange();
  }, [revision, onChange]);
}
