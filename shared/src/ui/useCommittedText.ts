import React from "react";

/**
 * Text for a field that saves when editing pauses, not on every keystroke.
 *
 * The field keeps its own text while being edited, and commits on blur or after `idleMs` without
 * typing, only if the text changed. A new `value` from outside (someone else's change, or our own
 * save coming back) replaces the text only when nothing is uncommitted, so a remote update never
 * moves the cursor or eats what's being typed.
 *
 * If `commit` resolves to `false`, the text is kept and stays uncommitted, so the next blur or pause
 * tries again instead of the edit being lost.
 */
export function useCommittedText(
  value: string,
  commit: (next: string) => Promise<boolean> | boolean | void,
  idleMs = 2000,
) {
  const [text, setText] = React.useState(value);
  // Refs, because commits finish asynchronously, after the render that started them.
  const textRef = React.useRef(value);
  /** The text last received from outside or committed; anything else on screen is uncommitted. */
  const committedRef = React.useRef(value);
  const inFlightRef = React.useRef(false);
  const latestValueRef = React.useRef(value);
  latestValueRef.current = value;
  const commitRef = React.useRef(commit);
  commitRef.current = commit;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (next: string) => {
    textRef.current = next;
    committedRef.current = next;
    setText(next);
  };

  // Adopt an outside change, unless there's uncommitted text or a commit whose result is still due.
  React.useEffect(() => {
    if (inFlightRef.current || textRef.current !== committedRef.current) return;
    if (value !== textRef.current) show(value);
  }, [value]);

  const flush = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = textRef.current;
    if (next === committedRef.current || inFlightRef.current) return;
    const previous = committedRef.current;
    committedRef.current = next;
    inFlightRef.current = true;
    void Promise.resolve(commitRef.current(next)).then((accepted) => {
      inFlightRef.current = false;
      if (accepted === false) {
        // Keep the text, marked uncommitted, so it's retried rather than lost.
        committedRef.current = previous;
        return;
      }
      // Typed more while saving: commit that too.
      if (textRef.current !== committedRef.current) {
        flush();
        return;
      }
      // An outside change that arrived during the save was held back; show it now.
      if (latestValueRef.current !== textRef.current) show(latestValueRef.current);
    });
  }, []);

  const onChange = React.useCallback((next: string) => {
    textRef.current = next;
    setText(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, idleMs);
  }, [flush, idleMs]);

  // Leaving the page shouldn't drop an edit still waiting out the pause.
  React.useEffect(() => () => flush(), [flush]);

  return { text, onChange, onBlur: flush };
}
