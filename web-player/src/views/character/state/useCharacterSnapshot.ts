import React from "react";
import { fetchMyCharacter } from "@/services/actorApi";
import type { Character } from "../CharacterViewHelpers";

export function useCharacterSnapshot(id: string | undefined) {
  const [char, updateChar] = React.useState<Character | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const revision = React.useRef(0);
  const snapshot = React.useRef<Character | null>(null);
  const active = React.useRef(true);
  const activeId = React.useRef(id);
  const retireScope = React.useCallback(() => {
    active.current = false;
    ++revision.current;
  }, []);
  React.useEffect(() => {
    active.current = true;
    activeId.current = id;
    // Retire the previous scope, including callbacks retained by old actions.
    return retireScope;
  }, [id, retireScope]);

  const setChar = React.useCallback<React.Dispatch<React.SetStateAction<Character | null>>>((value) => {
    const previous = snapshot.current;
    const next = typeof value === "function" ? value(previous) : value;
    if (next === previous) return;
    ++revision.current;
    snapshot.current = next;
    updateChar(next);
  }, []);

  // The single owner of every character read. Background refreshes and explicit
  // recovery reloads share one request-ordering guard, so a slow response can
  // never replace newer state or retire a newer pending read. `propagate` is the
  // only difference: an explicit reload rethrows its failure (so a caller
  // recovering from a conflict can react) while a background refresh only
  // records the error in state. A superseded reload resolves quietly — a newer
  // read is already in charge of the result.
  const load = React.useCallback(async (propagate: boolean) => {
    if (!id || !active.current || activeId.current !== id) return;
    const request = ++revision.current;
    try {
      const next = await fetchMyCharacter(id);
      if (active.current && request === revision.current) {
        snapshot.current = next as Character;
        updateChar(next as Character);
        setError(null);
      }
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error("Failed to load character");
      if (active.current && request === revision.current) {
        setError(failure.message);
        if (propagate) throw failure;
      }
    } finally {
      if (active.current && request === revision.current) setLoading(false);
    }
  }, [id]);

  const fetchChar = React.useCallback(() => load(false), [load]);
  const reloadChar = React.useCallback(() => load(true), [load]);

  React.useEffect(() => {
    snapshot.current = null;
    updateChar(null);
    setError(null);
    setLoading(Boolean(id));
    void fetchChar();
  }, [id, fetchChar]);
  return { char, setChar, loading, error, setError, fetchChar, reloadChar };
}
