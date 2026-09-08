import { useEffect, useRef, useState } from "react";

/** Keep an inline draft independent of background refreshes and pending saves. */
export function useRichTextDraft(value: string | null, onSave: (value: string | null) => Promise<void>) {
  const [editing, setEditing] = useState(false);
  const [draft, updateDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentDraft = useRef(draft);
  const pending = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  function setDraft(next: string) {
    currentDraft.current = next;
    updateDraft(next);
  }
  useEffect(() => {
    if (!editing) {
      currentDraft.current = value ?? "";
      updateDraft(value ?? "");
    }
  }, [value, editing]);
  function startEditing() {
    setDraft(value ?? "");
    setError(null);
    setEditing(true);
  }
  function cancel() {
    if (pending.current) return;
    setDraft(value ?? "");
    setError(null);
    setEditing(false);
  }
  async function save() {
    if (pending.current || !active.current) return;
    pending.current = true;
    const submitted = currentDraft.current;
    setSaving(true);
    setError(null);
    try {
      await onSave(submitted.trim() || null);
      if (active.current && currentDraft.current === submitted) setEditing(false);
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : "Unable to save. Please try again.");
    } finally {
      pending.current = false;
      if (active.current) setSaving(false);
    }
  }
  return { editing, draft, saving, error, setDraft, startEditing, cancel, save };
}
