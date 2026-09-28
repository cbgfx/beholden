import * as React from "react";
import type { CompendiumEditableKind, CompendiumEntryEditing, Ruleset } from "@beholden/shared/views/compendium/CompendiumHost";
import { ItemFormModal, type ItemForEdit } from "@beholden/shared/views/item-editor/ItemFormModal";
import type { CompendiumMonsterRow } from "@beholden/shared/domain/compendium/monsterPicker";
import { api } from "@/services/api";
import { SpellFormModal, type SpellForEdit } from "./panels/SpellFormModal";
import { MonsterFormModal, type MonsterForEdit } from "./panels/MonsterFormModal";
import { MonsterCreateChoiceModal, MonsterDuplicatePickerModal } from "./panels/MonsterBrowserModals";

type OnCreated = ((id: string, ruleset?: Ruleset) => void) | undefined;

/** Which editor is open, and for what. `entry` is null when creating. */
type OpenEditor =
  | { kind: "spell"; entry: SpellForEdit | null }
  | { kind: "item"; entry: ItemForEdit | null; onCreated?: OnCreated }
  | { kind: "monster"; entry: MonsterForEdit | null; isDuplicate?: boolean; onCreated?: OnCreated }
  | { kind: "monsterChoice"; onCreated?: OnCreated }
  | { kind: "monsterDuplicate"; onCreated?: OnCreated };

// Where each kind of entry lives on the server. Editing loads the stored (Grand) form of the entry.
const ENDPOINTS: Record<CompendiumEditableKind, string> = {
  spells: "/api/spells",
  items: "/api/compendium/items",
  monsters: "/api/compendium/monsters",
};

function entryUrl(kind: CompendiumEditableKind, id: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams(Object.entries(query).filter((pair): pair is [string, string] => Boolean(pair[1])));
  const suffix = params.toString();
  return `${ENDPOINTS[kind]}/${encodeURIComponent(id)}${suffix ? `?${suffix}` : ""}`;
}

const loadForEdit = <T,>(kind: CompendiumEditableKind, id: string, ruleset?: Ruleset) => api<T>(entryUrl(kind, id, { view: "grand", ruleset }));

/** Searches monsters for the "duplicate an existing monster" picker. */
function useMonsterDuplicateSearch(open: boolean) {
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<CompendiumMonsterRow[]>([]);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), limit: "200", sort: "az", fields: "id,ruleset,name,cr,type,environment" });
      api<CompendiumMonsterRow[] | { rows?: CompendiumMonsterRow[] }>(`/api/compendium/search?${params.toString()}`, { signal: controller.signal })
        .then((result) => { if (!controller.signal.aborted) setRows(Array.isArray(result) ? result : result?.rows ?? []); })
        .catch(() => { if (!controller.signal.aborted) setRows([]); });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);
  return { query, setQuery, rows };
}

/**
 * Editing for the DM's compendium: create, edit and delete for spells, items and monsters, and the
 * forms that do it. `onChanged` is called after every save or delete so the compendium reloads.
 */
export function useCompendiumEditing(onChanged: () => void) {
  const [open, setOpen] = React.useState<OpenEditor | null>(null);
  const [duplicateLoading, setDuplicateLoading] = React.useState<string | null>(null);
  const duplicateSearch = useMonsterDuplicateSearch(open?.kind === "monsterDuplicate");

  const editing = React.useMemo<Partial<Record<CompendiumEditableKind, CompendiumEntryEditing>>>(() => {
    const remove = (kind: CompendiumEditableKind) => async (id: string, ruleset?: Ruleset) => {
      await api(entryUrl(kind, id, { ruleset }), { method: "DELETE" });
      onChanged();
    };
    return {
      spells: {
        create: () => setOpen({ kind: "spell", entry: null }),
        edit: async (id, ruleset) => setOpen({ kind: "spell", entry: await loadForEdit<SpellForEdit>("spells", id, ruleset) }),
        remove: remove("spells"),
      },
      items: {
        create: (onCreated) => setOpen({ kind: "item", entry: null, onCreated }),
        edit: async (id, ruleset) => setOpen({ kind: "item", entry: await loadForEdit<ItemForEdit>("items", id, ruleset) }),
        remove: remove("items"),
      },
      monsters: {
        create: (onCreated) => setOpen({ kind: "monsterChoice", onCreated }),
        edit: async (id, ruleset) => setOpen({ kind: "monster", entry: await loadForEdit<MonsterForEdit>("monsters", id, ruleset) }),
        remove: remove("monsters"),
      },
    };
  }, [onChanged]);

  const close = () => setOpen(null);
  const saved = () => {
    close();
    onChanged();
  };

  const duplicate = async (id: string, ruleset?: Ruleset) => {
    if (open?.kind !== "monsterDuplicate") return;
    setDuplicateLoading(`${ruleset ?? ""}:${id}`);
    try {
      const source = await loadForEdit<MonsterForEdit>("monsters", id, ruleset);
      duplicateSearch.setQuery("");
      setOpen({ kind: "monster", entry: source, isDuplicate: true, onCreated: open.onCreated });
    } finally {
      setDuplicateLoading(null);
    }
  };

  const modals = (
    <>
      {open?.kind === "spell" && <SpellFormModal spell={open.entry} onClose={close} onSaved={saved} />}
      {open?.kind === "item" && (
        <ItemFormModal
          item={open.entry}
          request={api}
          onClose={close}
          onSaved={(id) => {
            const onCreated = open.entry == null ? open.onCreated : undefined;
            saved();
            if (id) onCreated?.(id);
          }}
        />
      )}
      {open?.kind === "monsterChoice" && (
        <MonsterCreateChoiceModal
          onClose={close}
          onCreateNew={() => setOpen({ kind: "monster", entry: null, onCreated: open.onCreated })}
          onDuplicateExisting={() => setOpen({ kind: "monsterDuplicate", onCreated: open.onCreated })}
        />
      )}
      {open?.kind === "monsterDuplicate" && (
        <MonsterDuplicatePickerModal
          searchQuery={duplicateSearch.query}
          rows={duplicateSearch.rows}
          loadingId={duplicateLoading}
          onClose={() => {
            duplicateSearch.setQuery("");
            close();
          }}
          onSearchChange={duplicateSearch.setQuery}
          onPick={duplicate}
        />
      )}
      {open?.kind === "monster" && (
        <MonsterFormModal
          monster={open.entry}
          isDuplicate={open.isDuplicate}
          onClose={close}
          onSaved={(id) => {
            const onCreated = open.entry == null || open.isDuplicate ? open.onCreated : undefined;
            saved();
            onCreated?.(id);
          }}
        />
      )}
    </>
  );

  return { editing, modals };
}
