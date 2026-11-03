import { useEffect, useRef, type ComponentProps } from "react";
import { useSearchParams } from "react-router-dom";
import { MarkdownRichText } from "./NoteRow";

/** A backlink selects a field and the Nth occurrence of one target, never a text search.
 * Record renames and repeated mentions therefore land on the intended link. */
export function ReferencedMarkdown({
  sourceField,
  ...props
}: ComponentProps<typeof MarkdownRichText> & { sourceField: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const target = params.get("mentionTarget");
  const field = params.get("mentionField");
  const occurrence = Number(params.get("mentionOccurrence") ?? 0);
  useEffect(() => {
    if (
      !target ||
      field !== sourceField ||
      !Number.isSafeInteger(occurrence) ||
      occurrence < 0
    )
      return;
    const links = Array.from(
      root.current?.querySelectorAll<HTMLAnchorElement>(
        "a[data-binder-record-id]",
      ) ?? [],
    );
    const link = links.filter((node) => node.dataset.binderRecordId === target)[
      occurrence
    ];
    if (!link) return;
    for (
      let parent = link.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
    }
    const previous = link.style.outline;
    link.style.outline = "2px solid #7dd3fc";
    link.style.outlineOffset = "3px";
    link.scrollIntoView?.({ block: "center", inline: "nearest" });
    link.focus({ preventScroll: true });
    return () => {
      link.style.outline = previous;
      link.style.outlineOffset = "";
    };
  }, [
    target,
    field,
    occurrence,
    sourceField,
    props.text,
    props.validMentionIds,
    props.binderId,
  ]);
  return (
    <div ref={root} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
      <MarkdownRichText {...props} />
    </div>
  );
}
