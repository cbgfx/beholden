import React from "react";
import { useCommittedText } from "@beholden/shared/ui";
import { Input } from "@/ui/Input";

type Commit<T> = (next: T) => Promise<boolean> | boolean | void;

/*
 * Fields that save when editing pauses or they lose focus, rather than on every keystroke (see
 * useCommittedText). A commit that resolves to `false` leaves the text in the field to try again.
 *
 * Give each one a `key` that includes the record's id, so switching to another bastion starts from
 * that bastion's value instead of carrying text across.
 */

export function CommittedInput(
  props: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur"> & {
    value: string;
    onCommit: Commit<string>;
  },
) {
  const { value, onCommit, ...rest } = props;
  const field = useCommittedText(value, onCommit);
  return <Input {...rest} value={field.text} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />;
}

export function CommittedTextArea(
  props: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "onBlur"> & {
    value: string;
    onCommit: Commit<string>;
  },
) {
  const { value, onCommit, ...rest } = props;
  const field = useCommittedText(value, onCommit);
  return <textarea {...rest} value={field.text} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />;
}

/** A whole, non-negative count. Anything else is refused and stays in the field to be corrected. */
export function CommittedCountInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "onBlur" | "type" | "min"> & {
    value: number;
    onCommit: Commit<number>;
  },
) {
  const { value, onCommit, ...rest } = props;
  const field = useCommittedText(String(value), (text) => {
    const parsed = text.trim() === "" ? 0 : Number(text);
    if (!Number.isFinite(parsed) || parsed < 0) return false;
    return onCommit(Math.floor(parsed));
  });
  return (
    <input
      {...rest}
      type="number"
      min={0}
      value={field.text}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
    />
  );
}
